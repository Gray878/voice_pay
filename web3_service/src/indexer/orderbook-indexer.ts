import { JsonRpcProvider, Interface, Contract } from 'ethers';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { ORDERBOOK_ABI, NFTMANAGER_ABI } from '../contracts/abis';
import type { Order, PersistedOrder, IndexState, IndexedOrder } from './types';

const iface = new Interface(ORDERBOOK_ABI);

function normAddr(a: string): string {
  return a.toLowerCase();
}

function toPersistedOrder(o: Order): PersistedOrder {
  return {
    side: o.side,
    saleKind: o.saleKind,
    maker: normAddr(o.maker),
    nft: {
      tokenId: o.nft.tokenId.toString(),
      collectionAddr: normAddr(o.nft.collectionAddr),
      amount: o.nft.amount.toString(),
    },
    price: o.price.toString(),
    currency: normAddr(o.currency),
    expiry: o.expiry.toString(),
    salt: o.salt.toString(),
  };
}

function fromPersistedOrder(p: PersistedOrder): Order {
  return {
    side: p.side,
    saleKind: p.saleKind,
    maker: p.maker,
    nft: {
      tokenId: BigInt(p.nft.tokenId),
      collectionAddr: p.nft.collectionAddr,
      amount: BigInt(p.nft.amount),
    },
    price: BigInt(p.price),
    currency: p.currency,
    expiry: BigInt(p.expiry),
    salt: BigInt(p.salt),
  };
}

function isSellOrder(o: Order): boolean {
  return o.side === 0 && o.saleKind === 1;
}

function isExpired(o: Order, nowSec: number): boolean {
  if (o.expiry === 0n) return false;
  return Number(o.expiry) <= nowSec;
}

async function readIndex(path: string): Promise<IndexState | null> {
  try {
    const raw = await fs.readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeIndex(path: string, state: IndexState): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(state, null, 2), 'utf8');
}

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  const set = new Set<string>();
  const parts = raw.split(/[,\s]+/g).map(s => s.trim()).filter(Boolean);
  for (const p of parts) {
    if (/^0x[0-9a-fA-F]{40}$/.test(p)) {
      set.add(p.toLowerCase());
    }
  }
  return set;
}

export interface IndexerConfig {
  RPC_URL: string;
  RPC_ENDPOINTS?: string[];
  CHAIN_ID: number;
  ORDERBOOK_ADDRESS: string;
  USDOL_ADDRESS: string;
  INDEX_PATH: string;
  INDEXER_FROM_BLOCK: number;
  COLLECTION_ALLOWLIST?: string;
}

export class OrderbookIndexer {
  private cfg: IndexerConfig;
  private provider: JsonRpcProvider;
  private urls: string[];

  constructor(cfg: IndexerConfig) {
    this.cfg = cfg;
    this.urls = Array.isArray(cfg.RPC_ENDPOINTS) && cfg.RPC_ENDPOINTS.length > 0 ? cfg.RPC_ENDPOINTS : [cfg.RPC_URL];
    this.provider = new JsonRpcProvider(this.urls[0], cfg.CHAIN_ID);
  }

  private async ensureProvider(): Promise<void> {
    try {
      await this.provider.getBlockNumber();
      return;
    } catch (e) {
      void e;
    }
    for (const u of this.urls) {
      const p = new JsonRpcProvider(u, this.cfg.CHAIN_ID);
      try {
        await p.getBlockNumber();
        this.provider = p;
        return;
      } catch (e) {
        void e;
      }
    }
    throw new Error('No healthy RPC endpoint');
  }

  async sync(): Promise<void> {
    await this.ensureProvider();
    const cfg = this.cfg;
    const existing = await readIndex(cfg.INDEX_PATH);

    const state: IndexState =
      existing &&
      existing.chainId === cfg.CHAIN_ID &&
      normAddr(existing.orderbook) === normAddr(cfg.ORDERBOOK_ADDRESS)
        ? existing
        : {
            chainId: cfg.CHAIN_ID,
            orderbook: cfg.ORDERBOOK_ADDRESS,
            lastScannedBlock: Math.max(0, cfg.INDEXER_FROM_BLOCK - 1),
            ordersByKey: {},
          };

    const head = await this.provider.getBlockNumber();
    // 当 RPC 为裁剪节点（无远古区块）时，若未配置 INDEX_FROM_BLOCK，从近期区块开始扫描，避免 "History has been pruned"
    const fromBlock =
      cfg.INDEXER_FROM_BLOCK > 0
        ? cfg.INDEXER_FROM_BLOCK
        : Math.max(1, head - 50000);
    const start = Math.max(fromBlock, state.lastScannedBlock + 1);

    if (start > head) return;

    const step = parseInt(process.env.INDEXER_BATCH_SIZE || '500', 10);
    for (let from = start; from <= head; from += step) {
      const to = Math.min(head, from + step - 1);
      await this.scanRange(state, from, to);
      state.lastScannedBlock = to;
      await writeIndex(cfg.INDEX_PATH, state);
    }
  }

  private async scanRange(state: IndexState, fromBlock: number, toBlock: number): Promise<void> {
    await this.ensureProvider();
    const addr = this.cfg.ORDERBOOK_ADDRESS;
    const ob = new Contract(addr, ORDERBOOK_ABI, this.provider);

    const makeEv = iface.getEvent('LogMake');
    const cancelEv = iface.getEvent('LogCancel');
    const matchEv = iface.getEvent('LogMatch');

    if (!makeEv || !cancelEv || !matchEv) {
      throw new Error('ORDERBOOK_ABI missing required events');
    }

    const makeTopic = makeEv.topicHash;
    const cancelTopic = cancelEv.topicHash;
    const matchTopic = matchEv.topicHash;

    const makeLogs = await this.getLogsSafe(addr, makeTopic, fromBlock, toBlock);
    const cancelLogs = await this.getLogsSafe(addr, cancelTopic, fromBlock, toBlock);
    const matchLogs = await this.getLogsSafe(addr, matchTopic, fromBlock, toBlock);

    for (const log of makeLogs) {
      let parsed;
      try {
        parsed = iface.parseLog(log);
      } catch {
        continue;
      }
      if (!parsed) continue;

      const orderKey = String(parsed.args.orderKey);
      let full: any;
      try {
        const res = await ob.orders(orderKey);
        full = res?.order ?? res?.[0]?.order ?? res?.[0] ?? res?.order;
      } catch {
        full = null;
      }
      if (!full) continue;

      const order: Order = {
        side: Number(full.side),
        saleKind: Number(full.saleKind),
        maker: normAddr(String(full.maker)),
        nft: {
          tokenId: BigInt(full.nft.tokenId),
          collectionAddr: normAddr(String(full.nft.collectionAddr)),
          amount: BigInt(full.nft.amount),
        },
        price: BigInt(full.price),
        currency: normAddr(String(full.currency)),
        expiry: BigInt(full.expiry),
        salt: BigInt(full.salt),
      };

      if (!isSellOrder(order)) continue;

      const existing = state.ordersByKey[orderKey];
      const persisted: IndexedOrder = {
        orderKey,
        order: toPersistedOrder(order),
        status: existing?.status === 'filled' ? 'filled' : 'open',
        firstSeenBlock: existing?.firstSeenBlock ?? log.blockNumber,
        lastUpdateBlock: log.blockNumber,
      };
      state.ordersByKey[orderKey] = persisted;
    }

    for (const log of cancelLogs) {
      let parsed;
      try {
        parsed = iface.parseLog(log);
      } catch {
        continue;
      }
      if (!parsed) continue;

      const orderKey = String(parsed.args.orderKey);
      const existing = state.ordersByKey[orderKey];
      if (!existing) continue;

      existing.status = 'cancelled';
      existing.lastUpdateBlock = log.blockNumber;
    }

    for (const log of matchLogs) {
      let parsed;
      try {
        parsed = iface.parseLog(log);
      } catch {
        continue;
      }
      if (!parsed) continue;

      const makeOrderKey = String(parsed.args.makeOrderKey);
      const takeOrderKey = String(parsed.args.takeOrderKey);
      const makeOrder = parsed.args.makeOrder;
      const takeOrder = parsed.args.takeOrder;

      const makeSide = Number(makeOrder.side);
      const takeSide = Number(takeOrder.side);
      const sellKey = makeSide === 0 ? makeOrderKey : takeSide === 0 ? takeOrderKey : null;

      if (sellKey) {
        const existing = state.ordersByKey[sellKey];
        if (existing) {
          existing.status = 'filled';
          existing.lastUpdateBlock = log.blockNumber;
        }
      }
    }
  }

  private async getLogsSafe(address: string, topic: string, fromBlock: number, toBlock: number): Promise<Array<any>> {
    const out: Array<any> = [];
    const stack: Array<{ from: number; to: number; attempts: number }> = [{ from: fromBlock, to: toBlock, attempts: 0 }];
    while (stack.length > 0) {
      const { from, to, attempts } = stack.pop()!;
      try {
        await this.ensureProvider();
        const logs = await this.provider.getLogs({ address, fromBlock: from, toBlock: to, topics: [topic] });
        out.push(...logs);
        continue;
      } catch (e) {
        if (from < to) {
          const mid = Math.floor((from + to) / 2);
          stack.push({ from: mid + 1, to, attempts: attempts + 1 });
          stack.push({ from, to: mid, attempts: attempts + 1 });
          continue;
        }
        if (attempts < 2) {
          await new Promise(r => setTimeout(r, 500 * (attempts + 1)));
          stack.push({ from, to, attempts: attempts + 1 });
          continue;
        }
        throw e;
      }
    }
    return out;
  }

  async getActiveSellOrders(): Promise<
    Array<{
      orderKey: string;
      order: Order;
      status: string;
      firstSeenBlock: number;
      lastUpdateBlock: number;
    }>
  > {
    const state = await readIndex(this.cfg.INDEX_PATH);
    if (!state) return [];

    const nowSec = Math.floor(Date.now() / 1000);
    const allowlist = parseAllowlist(this.cfg.COLLECTION_ALLOWLIST);
    const allowOnly = allowlist.size > 0;

    const out: Array<{
      orderKey: string;
      order: Order;
      status: string;
      firstSeenBlock: number;
      lastUpdateBlock: number;
    }> = [];

    for (const [orderKey, p] of Object.entries(state.ordersByKey)) {
      if (p.status !== 'open') continue;

      const order = fromPersistedOrder(p.order);
      if (!isSellOrder(order)) continue;
      if (normAddr(order.currency) !== normAddr(this.cfg.USDOL_ADDRESS)) continue;
      if (order.nft.amount !== 1n) continue;
      if (isExpired(order, nowSec)) continue;
      if (allowOnly && !allowlist.has(normAddr(order.nft.collectionAddr))) continue;

      out.push({
        orderKey,
        order,
        status: p.status,
        firstSeenBlock: p.firstSeenBlock,
        lastUpdateBlock: p.lastUpdateBlock,
      });
    }

    return out;
  }

  async getOrderByKey(orderKey: string): Promise<{
    orderKey: string;
    order: Order;
    status: string;
    firstSeenBlock: number;
    lastUpdateBlock: number;
  } | null> {
    const state = await readIndex(this.cfg.INDEX_PATH);
    if (!state) return null;
    const entry = state.ordersByKey[orderKey];
    if (!entry) return null;
    return {
      orderKey,
      order: fromPersistedOrder(entry.order),
      status: entry.status,
      firstSeenBlock: entry.firstSeenBlock,
      lastUpdateBlock: entry.lastUpdateBlock,
    };
  }

  async getOrdersByKeys(orderKeys: string[]): Promise<
    Array<{
      orderKey: string;
      order: Order;
      status: string;
      firstSeenBlock: number;
      lastUpdateBlock: number;
    }>
  > {
    const state = await readIndex(this.cfg.INDEX_PATH);
    if (!state) return [];
    const out: Array<{
      orderKey: string;
      order: Order;
      status: string;
      firstSeenBlock: number;
      lastUpdateBlock: number;
    }> = [];
    for (const orderKey of orderKeys) {
      const entry = state.ordersByKey[orderKey];
      if (!entry) continue;
      out.push({
        orderKey,
        order: fromPersistedOrder(entry.order),
        status: entry.status,
        firstSeenBlock: entry.firstSeenBlock,
        lastUpdateBlock: entry.lastUpdateBlock,
      });
    }
    return out;
  }

  async floorPrice(): Promise<bigint | null> {
    const orders = await this.getActiveSellOrders();
    if (orders.length === 0) return null;

    let min = orders[0].order.price;
    for (const o of orders) {
      if (o.order.price < min) min = o.order.price;
    }
    return min;
  }

  async getTokenURI(collectionAddr: string, tokenId: bigint): Promise<string | null> {
    try {
      await this.ensureProvider();
      const contract = new Contract(collectionAddr, NFTMANAGER_ABI, this.provider);
      const tokenURI = await contract.tokenURI(tokenId);
      return typeof tokenURI === 'string' ? tokenURI : String(tokenURI);
    } catch {
      return null;
    }
  }

  async cheapestN(
    n: number
  ): Promise<Array<{ orderKey: string; order: Order; status: string; firstSeenBlock: number; lastUpdateBlock: number }>> {
    const orders = await this.getActiveSellOrders();
    orders.sort((a, b) => (a.order.price < b.order.price ? -1 : a.order.price > b.order.price ? 1 : 0));
    return orders.slice(0, n);
  }

  async cheapestForTokenId(
    tokenId: bigint
  ): Promise<{ orderKey: string; order: Order; status: string; firstSeenBlock: number; lastUpdateBlock: number } | null> {
    const orders = await this.getActiveSellOrders();
    let best: { orderKey: string; order: Order; status: string; firstSeenBlock: number; lastUpdateBlock: number } | null = null;

    for (const o of orders) {
      if (o.order.nft.tokenId !== tokenId) continue;
      if (!best || o.order.price < best.order.price) best = o;
    }

    return best;
  }
}
