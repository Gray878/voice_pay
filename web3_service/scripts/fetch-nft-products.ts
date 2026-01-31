/**
 * 通过 RPC 获取订单簿中的 NFT 商品脚本
 *
 * 用法（在 web3_service 目录下）：
 *   npx ts-node scripts/fetch-nft-products.ts [选项]
 *
 * 选项：
 *   --from-block <n>  起始区块（默认：当前区块 - 10000）
 *   --to-block <n>    结束区块（默认：当前区块）
 *   --limit <n>       最多返回条数（默认 50）
 *   --metadata        拉取 tokenURI / name（会多调 RPC 和 HTTP）
 *   --output <path>  写入 JSON 文件（不写则打印到 stdout）
 *   --verbose        打印调试信息到 stderr（RPC、区块范围、事件条数、过滤原因）
 *   --batch-size <n> 每段区块数（覆盖 .env 的 INDEXER_BATCH_SIZE，RPC 报 code 19 时用 50）
 *   --v1             仅使用 OrderCreated（本地 OrderBook.sol）；默认先试 OrderCreated 再试 LogMake
 *
 * 依赖 .env：EVM_RPC_URL、ORDERBOOK_ADDRESS、USDOL_ADDRESS、EVM_CHAIN_ID
 * 可选 .env：INDEXER_BATCH_SIZE 每段区块数（默认 2000）；脚本会加载 web3_service/.env 与 cwd/.env
 *
 * 若结果为 []：加 --verbose 看「OrderCreated/LogMake 事件数」和「过滤统计」。
 * - 事件数=0：该区块区间内没有挂单，或 ORDERBOOK_ADDRESS/链/RPC 不对；可试 --from-block <合约部署区块>。
 * - 事件数>0 但过滤掉：检查 orderType=1(卖)、status=0(ACTIVE)；或 USDOL/过期/amount 等。
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { JsonRpcProvider, Contract, Interface } from 'ethers';
import axios from 'axios';

// 加载 .env：先试 web3_service/.env，再试当前工作目录 .env（确保 INDEXER_BATCH_SIZE 等生效）
const envPath = path.resolve(__dirname, '../.env');
const cwdEnvPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}
if (cwdEnvPath !== envPath && fs.existsSync(cwdEnvPath)) {
  dotenv.config({ path: cwdEnvPath, override: true });
}

// OrderbookV2 风格（LogMake / orderKey）
const ORDERBOOK_ABI = [
  'event LogMake(bytes32 orderKey,uint8 indexed side,uint8 indexed saleKind,address indexed maker,(uint256 tokenId,address collectionAddr,uint96 amount) nft,uint128 price,address currency,uint64 expiry,uint64 salt)',
  'function orders(bytes32) view returns (tuple(tuple(uint8 side,uint8 saleKind,address maker,(uint256 tokenId,address collectionAddr,uint96 amount) nft,uint128 price,address currency,uint64 expiry,uint64 salt) order, bytes32 next))',
];

// 本地 OrderBook.sol 风格（OrderCreated / orderId）
const ORDERBOOK_V1_ABI = [
  'event OrderCreated(uint256 indexed orderId,address indexed trader,uint8 orderType,address indexed tokenAddress,uint256 amount,uint256 price,uint256 timestamp)',
  'function orders(uint256) view returns (uint256 orderId,address trader,uint8 orderType,address tokenAddress,uint256 amount,uint256 price,uint256 timestamp,uint8 status)',
];

const NFT_ABI = ['function tokenURI(uint256 tokenId) view returns (string)'];

const iface = new Interface(ORDERBOOK_ABI);
const ifaceV1 = new Interface(ORDERBOOK_V1_ABI);

interface ParsedMake {
  args: { orderKey: string; nft: { tokenId: bigint; collectionAddr: string }; price: bigint; maker: string; currency: string };
}

interface ParsedOrderCreated {
  args: { orderId: bigint; trader: string; orderType: number; tokenAddress: string; amount: bigint; price: bigint; timestamp: bigint };
}

function parseNameFromTokenURI(tokenURI: string | null): string | null {
  if (!tokenURI) return null;
  if (tokenURI.startsWith('data:application/json;base64,')) {
    try {
      const b64 = tokenURI.slice('data:application/json;base64,'.length);
      const json = Buffer.from(b64, 'base64').toString('utf8');
      const obj = JSON.parse(json);
      return typeof obj?.name === 'string' ? obj.name : null;
    } catch {
      return null;
    }
  }
  if (tokenURI.startsWith('data:application/json,')) {
    try {
      const raw = tokenURI.slice('data:application/json,'.length);
      const json = decodeURIComponent(raw);
      const obj = JSON.parse(json);
      return typeof obj?.name === 'string' ? obj.name : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function fetchNameFromUrl(url: string): Promise<string | null> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { accept: 'application/json' },
      responseType: 'text',
      maxContentLength: 2_000_000,
    });
    const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    return typeof data?.name === 'string' ? data.name : null;
  } catch {
    return null;
  }
}

async function getTokenURI(
  provider: JsonRpcProvider,
  collectionAddr: string,
  tokenId: bigint
): Promise<string | null> {
  try {
    const nft = new Contract(collectionAddr, NFT_ABI, provider);
    const uri = await nft.tokenURI(tokenId);
    return typeof uri === 'string' ? uri : String(uri);
  } catch {
    return null;
  }
}

async function getNftName(
  provider: JsonRpcProvider,
  collectionAddr: string,
  tokenId: bigint
): Promise<{ tokenURI: string | null; name: string | null }> {
  const tokenURI = await getTokenURI(provider, collectionAddr, tokenId);
  let name = parseNameFromTokenURI(tokenURI);
  if (!name && tokenURI) name = await fetchNameFromUrl(tokenURI);
  return { tokenURI, name };
}

function parseArgs(): {
  fromBlock?: number;
  toBlock?: number;
  limit: number;
  metadata: boolean;
  output?: string;
  verbose: boolean;
  batchSize?: number;
  v1Only: boolean;
} {
  const args = process.argv.slice(2);
  let fromBlock: number | undefined;
  let toBlock: number | undefined;
  let limit = 50;
  let metadata = false;
  let output: string | undefined;
  let verbose = false;
  let batchSize: number | undefined;
  let v1Only = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from-block' && args[i + 1] != null) {
      fromBlock = parseInt(args[++i], 10);
    } else if (args[i] === '--to-block' && args[i + 1] != null) {
      toBlock = parseInt(args[++i], 10);
    } else if (args[i] === '--limit' && args[i + 1] != null) {
      limit = parseInt(args[++i], 10) || 50;
    } else if (args[i] === '--metadata') {
      metadata = true;
    } else if (args[i] === '--output' && args[i + 1] != null) {
      output = args[++i];
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    } else if (args[i] === '--batch-size' && args[i + 1] != null) {
      batchSize = parseInt(args[++i], 10) || 2000;
    } else if (args[i] === '--v1') {
      v1Only = true;
    }
  }

  return { fromBlock, toBlock, limit, metadata, output, verbose, batchSize, v1Only };
}

async function main() {
  const rpcUrl =
    process.env.EVM_RPC_URL ||
    process.env.EVM_RPC_ENDPOINTS?.split(/[,\s]+/)[0]?.trim() ||
    process.env.WHIMLAND_RPC_URL ||
    '';
  const chainId = parseInt(
    process.env.EVM_CHAIN_ID || process.env.WHIMLAND_CHAIN_ID || '0',
    10
  );
  const orderbookAddress =
    process.env.ORDERBOOK_ADDRESS || '';
  const usdolAddress = process.env.USDOL_ADDRESS || '';

  if (!rpcUrl || !orderbookAddress || !usdolAddress) {
    console.error(
      '缺少环境变量：请设置 EVM_RPC_URL（或 EVM_RPC_ENDPOINTS）、ORDERBOOK_ADDRESS、USDOL_ADDRESS'
    );
    process.exit(1);
  }

  const { fromBlock, toBlock, limit, metadata, output, verbose, batchSize: batchSizeArg, v1Only } = parseArgs();

  const provider = new JsonRpcProvider(rpcUrl, chainId);
  let head: number;
  try {
    head = await provider.getBlockNumber();
  } catch (e: any) {
    const msg = e?.shortMessage || e?.message || String(e);
    if (msg.includes('not valid JSON') || msg.includes('bodyJson')) {
      console.error(
        'RPC 返回了非 JSON（常见原因：EVM_RPC_URL 填成了区块浏览器地址，或 .env 未生效）。\n' +
        '请确认：\n' +
        '  1) .env 在 web3_service 目录下: ' + envPath + ' 或当前目录: ' + cwdEnvPath + '\n' +
        '  2) EVM_RPC_URL 为 JSON-RPC 地址，例如: https://polygon-amoy.drpc.org\n' +
        '  3) 不要使用 https://amoy.polygonscan.com（这是浏览器，不是 RPC）\n' +
        '  4) 若刚改过 .env，请新开一个终端再运行'
      );
    }
    throw e;
  }

  const from = fromBlock ?? Math.max(1, head - 10000);
  const to = toBlock ?? head;

  if (from > to) {
    console.error('--from-block 不能大于 --to-block');
    process.exit(1);
  }

  if (verbose) {
    console.error('[verbose] .env 已加载: %s', fs.existsSync(envPath) ? envPath : (fs.existsSync(cwdEnvPath) ? cwdEnvPath : '无'));
    const rpcShort = rpcUrl.length > 50 ? rpcUrl.slice(0, 40) + '...' + rpcUrl.slice(-8) : rpcUrl;
    console.error('[verbose] RPC: %s', rpcShort);
    console.error('[verbose] CHAIN_ID: %s', chainId);
    console.error('[verbose] ORDERBOOK_ADDRESS: %s', orderbookAddress);
    console.error('[verbose] USDOL_ADDRESS: %s', usdolAddress);
    console.error('[verbose] 当前区块: %s, 扫描区间: [%s, %s]', head, from, to);
  }

  const chunkSize = batchSizeArg ?? parseInt(process.env.INDEXER_BATCH_SIZE || '2000', 10);
  if (verbose) {
    console.error('[verbose] 分片大小 INDEXER_BATCH_SIZE: %s（来源: %s）', chunkSize, batchSizeArg != null ? '--batch-size' : '.env 或默认');
  }

  type ProductEntry = {
    orderKey: string;
    collectionAddr: string;
    tokenId: string;
    price: string;
    priceUSD: number;
    maker: string;
    tokenURI?: string | null;
    name?: string | null;
  };
  const products: ProductEntry[] = [];
  const norm = (a: string) => a.toLowerCase();
  type DebugStats = { parseLogFail: number; noArgs: number; ordersFail: number; noFull: number; notSell: number; wrongCurrency: number; amountNot1: number; expired: number };
  const debug: DebugStats | null = verbose ? { parseLogFail: 0, noArgs: 0, ordersFail: 0, noFull: 0, notSell: 0, wrongCurrency: 0, amountNot1: 0, expired: 0 } : null;
  const v1Debug = verbose ? { parseLogFail: 0, noArgs: 0, notSell: 0, ordersFail: 0, notActive: 0 } : null;

  // 1) 先试 OrderCreated（本地 OrderBook.sol，部署合约发的是此事件）；或 --v1 时仅用此路径
  const orderCreatedEv = ifaceV1.getEvent('OrderCreated');
  if (!orderCreatedEv) throw new Error('OrderCreated not in V1 ABI');
  const orderCreatedTopic = orderCreatedEv.topicHash;
  let allLogsV1: Awaited<ReturnType<typeof provider.getLogs>> = [];
  for (let start = from; start <= to; start += chunkSize) {
    const end = Math.min(to, start + chunkSize - 1);
    const chunk = await provider.getLogs({
      address: orderbookAddress,
      fromBlock: start,
      toBlock: end,
      topics: [orderCreatedTopic],
    });
    allLogsV1.push(...chunk);
    if (verbose) console.error('[verbose] 区块 [%s, %s] OrderCreated: %s', start, end, chunk.length);
  }
  if (verbose) console.error('[verbose] OrderCreated 事件总数: %s', allLogsV1.length);

  if (allLogsV1.length > 0) {
    const obV1 = new Contract(orderbookAddress, ORDERBOOK_V1_ABI, provider);
    for (let i = 0; i < allLogsV1.length && products.length < limit; i++) {
      const log = allLogsV1[i];
      let parsed: ParsedOrderCreated | null = null;
      try {
        const p = ifaceV1.parseLog({ topics: [...(log.topics || [])], data: log.data || '0x' });
        parsed = p ? (p as unknown as ParsedOrderCreated) : null;
      } catch {
        if (v1Debug) v1Debug.parseLogFail++;
        continue;
      }
      if (!parsed?.args) {
        if (v1Debug) v1Debug.noArgs++;
        continue;
      }
      if (Number(parsed.args.orderType) !== 1) {
        if (v1Debug) v1Debug.notSell++;
        continue;
      } // 1 = SELL
      const orderId = parsed.args.orderId;
      let full: { orderId: bigint; trader: string; orderType: number; tokenAddress: string; amount: bigint; price: bigint; timestamp: bigint; status: number } | null = null;
      try {
        const res = await obV1.orders(orderId);
        full = res ? { orderId: res.orderId ?? orderId, trader: String(res.trader), orderType: Number(res.orderType), tokenAddress: String(res.tokenAddress), amount: BigInt(res.amount ?? 0), price: BigInt(res.price ?? 0), timestamp: BigInt(res.timestamp ?? 0), status: Number(res.status ?? 0) } : null;
      } catch {
        if (v1Debug) v1Debug.ordersFail++;
        continue;
      }
      if (!full || Number(full.status) !== 0) {
        if (v1Debug) v1Debug.notActive++;
        continue;
      } // 0 = ACTIVE
      const price = full.price.toString();
      const priceUSD = Number(full.price) / 1e18;
      products.push({
        orderKey: full.orderId.toString(),
        collectionAddr: norm(full.tokenAddress),
        tokenId: full.amount.toString(),
        price,
        priceUSD,
        maker: norm(full.trader),
      });
    }
    if (verbose && v1Debug) {
      console.error('[verbose] OrderCreated 过滤: parseLog失败=%s 无args=%s 非卖单=%s orders()失败=%s 非ACTIVE=%s',
        v1Debug.parseLogFail, v1Debug.noArgs, v1Debug.notSell, v1Debug.ordersFail, v1Debug.notActive);
    }
  }

  // 2) 未指定 --v1 且 OrderCreated 无结果时，再试 LogMake（OrderbookV2）
  if (!v1Only && products.length === 0) {
    const makeEv = iface.getEvent('LogMake');
    const makeTopic = makeEv ? makeEv.topicHash : null;
    let allLogs: Awaited<ReturnType<typeof provider.getLogs>> = [];
    if (makeTopic) {
      for (let start = from; start <= to; start += chunkSize) {
        const end = Math.min(to, start + chunkSize - 1);
        const chunk = await provider.getLogs({
          address: orderbookAddress,
          fromBlock: start,
          toBlock: end,
          topics: [makeTopic],
        });
        allLogs.push(...chunk);
        if (verbose) console.error('[verbose] 区块 [%s, %s] LogMake: %s', start, end, chunk.length);
      }
    }
    if (verbose) console.error('[verbose] LogMake 事件总数: %s', allLogs.length);

    if (allLogs.length > 0) {
      const ob = new Contract(orderbookAddress, ORDERBOOK_ABI, provider);
      const usdolNorm = norm(usdolAddress);
      for (let i = 0; i < allLogs.length && products.length < limit; i++) {
        const log = allLogs[i];
        let parsed: ParsedMake | null = null;
        try {
          const p = iface.parseLog({ topics: [...(log.topics || [])], data: log.data || '0x' });
          parsed = p ? (p as unknown as ParsedMake) : null;
        } catch {
          if (debug) debug.parseLogFail++;
          continue;
        }
        if (!parsed?.args) {
          if (debug) debug.noArgs++;
          continue;
        }
        const orderKey = String(parsed.args.orderKey);
        let full: { side: number; saleKind: number; maker: string; nft: { tokenId: bigint; collectionAddr: string; amount: bigint }; price: bigint; currency: string; expiry: bigint } | null = null;
        try {
          const res = await ob.orders(orderKey);
          full = (res as any)?.order ?? (res as any)?.[0]?.order ?? (res as any)?.[0] ?? (res as any)?.order ?? null;
        } catch {
          if (debug) debug.ordersFail++;
          continue;
        }
        if (!full) {
          if (debug) debug.noFull++;
          continue;
        }
        const order = full;
        if (Number(order.side) !== 0 || Number(order.saleKind) !== 1) {
          if (debug) debug.notSell++;
          continue;
        }
        if (norm(String(order.currency)) !== usdolNorm) {
          if (debug) debug.wrongCurrency++;
          continue;
        }
        if (BigInt((order.nft as any).amount ?? 0) !== 1n) {
          if (debug) debug.amountNot1++;
          continue;
        }
        const expiry = BigInt((order as any).expiry ?? 0);
        if (expiry !== 0n && Number(expiry) <= Math.floor(Date.now() / 1000)) {
          if (debug) debug.expired++;
          continue;
        }
        const price = order.price.toString();
        const priceUSD = Number(order.price) / 1_000_000;
        const entry: ProductEntry = {
          orderKey,
          collectionAddr: norm(order.nft.collectionAddr),
          tokenId: order.nft.tokenId.toString(),
          price,
          priceUSD,
          maker: norm(order.maker),
        };
        if (metadata) {
          const { tokenURI: uri, name: nftName } = await getNftName(provider, order.nft.collectionAddr, order.nft.tokenId);
          entry.tokenURI = uri;
          entry.name = nftName;
        }
        products.push(entry);
      }
      if (verbose && debug) {
        console.error('[verbose] LogMake 过滤: parseLog失败=%s 无args=%s orders()失败=%s 无订单=%s 非卖单=%s 币种不符=%s amount!=1=%s 已过期=%s',
          debug.parseLogFail, debug.noArgs, debug.ordersFail, debug.noFull, debug.notSell, debug.wrongCurrency, debug.amountNot1, debug.expired);
      }
    }
  }

  if (verbose) {
    console.error('[verbose] 最终商品数: %s', products.length);
    // 无结果时诊断：该合约在该区块是否有任意事件（不按 topic 过滤）
    if (products.length === 0) {
      try {
        const rawLogs = await provider.getLogs({
          address: orderbookAddress,
          fromBlock: from,
          toBlock: to,
        });
        console.error('[verbose] 诊断：合约 %s 在区块 [%s, %s] 内原始日志数（不按 topic 过滤）: %s', orderbookAddress, from, to, rawLogs.length);
        if (rawLogs.length > 0) {
          const orderCreatedTopic = ifaceV1.getEvent('OrderCreated')?.topicHash ?? '';
          console.error('[verbose] 期望 OrderCreated topic[0]: %s', orderCreatedTopic);
          rawLogs.slice(0, 5).forEach((log, i) => {
            const t0 = (log.topics && log.topics[0]) ? String(log.topics[0]) : '';
            console.error('[verbose]   日志[%s] topic[0]: %s %s', i, t0, t0 === orderCreatedTopic ? '(匹配 OrderCreated)' : '');
          });
        } else {
          console.error('[verbose] 若网站显示该区块有订单，请核对：1) ORDERBOOK_ADDRESS 是否与网站合约一致 2) 订单是否在其它区块 3) 链/网络是否一致（Amoy 80002）');
        }
      } catch (e: any) {
        console.error('[verbose] 诊断 getLogs 失败: %s', e?.message || e);
      }
    }
  }

  const json = JSON.stringify(products, null, 2);

  if (output) {
    const fs = await import('fs');
    const outPath = path.isAbsolute(output) ? output : path.resolve(process.cwd(), output);
    fs.writeFileSync(outPath, json, 'utf8');
    console.error(`已写入 ${products.length} 条商品到 ${outPath}`);
  } else {
    console.log(json);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
