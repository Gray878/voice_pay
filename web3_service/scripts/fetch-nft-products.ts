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
 *   --verbose        打印调试信息到 stderr（RPC、区块范围、LogMake 条数、过滤原因）
 *
 * 依赖 .env：EVM_RPC_URL（或 EVM_RPC_ENDPOINTS 第一个）、EVM_CHAIN_ID、
 *            ORDERBOOK_ADDRESS、USDOL_ADDRESS
 *
 * 若结果为 []：先加 --verbose 看「LogMake 事件数」和「过滤统计」。
 * - LogMake=0：该区块区间内没有挂单，或 ORDERBOOK_ADDRESS/链/RPC 不对；可试 --from-block <合约部署区块>。
 * - LogMake>0 但过滤掉：检查 USDOL_ADDRESS 是否与订单币种一致；订单是否已过期、非卖单、amount!=1。
 */

import dotenv from 'dotenv';
import path from 'path';
import { JsonRpcProvider, Contract, Interface } from 'ethers';
import axios from 'axios';

// 加载 web3_service 根目录 .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ORDERBOOK_ABI = [
  'event LogMake(bytes32 orderKey,uint8 indexed side,uint8 indexed saleKind,address indexed maker,(uint256 tokenId,address collectionAddr,uint96 amount) nft,uint128 price,address currency,uint64 expiry,uint64 salt)',
  'function orders(bytes32) view returns (tuple(tuple(uint8 side,uint8 saleKind,address maker,(uint256 tokenId,address collectionAddr,uint96 amount) nft,uint128 price,address currency,uint64 expiry,uint64 salt) order, bytes32 next))',
];

const NFT_ABI = ['function tokenURI(uint256 tokenId) view returns (string)'];

const iface = new Interface(ORDERBOOK_ABI);

interface ParsedMake {
  args: { orderKey: string; nft: { tokenId: bigint; collectionAddr: string }; price: bigint; maker: string; currency: string };
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
} {
  const args = process.argv.slice(2);
  let fromBlock: number | undefined;
  let toBlock: number | undefined;
  let limit = 50;
  let metadata = false;
  let output: string | undefined;
  let verbose = false;

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
    }
  }

  return { fromBlock, toBlock, limit, metadata, output, verbose };
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

  const { fromBlock, toBlock, limit, metadata, output, verbose } = parseArgs();

  const provider = new JsonRpcProvider(rpcUrl, chainId);
  const head = await provider.getBlockNumber();

  const from = fromBlock ?? Math.max(1, head - 10000);
  const to = toBlock ?? head;

  if (from > to) {
    console.error('--from-block 不能大于 --to-block');
    process.exit(1);
  }

  if (verbose) {
    const rpcShort = rpcUrl.length > 50 ? rpcUrl.slice(0, 40) + '...' + rpcUrl.slice(-8) : rpcUrl;
    console.error('[verbose] RPC: %s', rpcShort);
    console.error('[verbose] CHAIN_ID: %s', chainId);
    console.error('[verbose] ORDERBOOK_ADDRESS: %s', orderbookAddress);
    console.error('[verbose] USDOL_ADDRESS: %s', usdolAddress);
    console.error('[verbose] 当前区块: %s, 扫描区间: [%s, %s]', head, from, to);
  }

  const makeEv = iface.getEvent('LogMake');
  if (!makeEv) throw new Error('LogMake not in ABI');
  const makeTopic = makeEv.topicHash;

  let logs: Awaited<ReturnType<typeof provider.getLogs>>;
  try {
    logs = await provider.getLogs({
      address: orderbookAddress,
      fromBlock: from,
      toBlock: to,
      topics: [makeTopic],
    });
  } catch (e) {
    console.error('eth_getLogs 失败（常见原因：RPC 裁剪了该区块区间历史）: %s', (e as Error).message);
    throw e;
  }

  if (verbose) {
    console.error('[verbose] LogMake 事件数: %s', logs.length);
  }

  const ob = new Contract(orderbookAddress, ORDERBOOK_ABI, provider);
  const products: Array<{
    orderKey: string;
    collectionAddr: string;
    tokenId: string;
    price: string;
    priceUSD: number;
    maker: string;
    tokenURI?: string | null;
    name?: string | null;
  }> = [];

  const norm = (a: string) => a.toLowerCase();
  const usdolNorm = norm(usdolAddress);

  const debug = verbose ? { parseLogFail: 0, noArgs: 0, ordersFail: 0, noFull: 0, notSell: 0, wrongCurrency: 0, amountNot1: 0, expired: 0 } : null;

  for (let i = 0; i < logs.length && products.length < limit; i++) {
    const log = logs[i];
    let parsed: ParsedMake | null = null;
    try {
      const p = iface.parseLog({ topics: [...(log.topics || [])], data: log.data || '0x' });
      parsed = p ? (p as unknown as ParsedMake) : null;
    } catch {
      if (debug) debug.parseLogFail++;
      continue;
    }
    if (!parsed || !parsed.args) {
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
    const entry: (typeof products)[0] = {
      orderKey,
      collectionAddr: norm(order.nft.collectionAddr),
      tokenId: order.nft.tokenId.toString(),
      price,
      priceUSD,
      maker: norm(order.maker),
    };

    if (metadata) {
      const { tokenURI: uri, name: nftName } = await getNftName(
        provider,
        order.nft.collectionAddr,
        order.nft.tokenId
      );
      entry.tokenURI = uri;
      entry.name = nftName;
    }

    products.push(entry);
  }

  if (verbose && debug) {
    console.error('[verbose] 过滤统计: parseLog失败=%s 无args=%s orders()失败=%s 无订单=%s 非卖单=%s 币种不符=%s amount!=1=%s 已过期=%s',
      debug.parseLogFail, debug.noArgs, debug.ordersFail, debug.noFull, debug.notSell, debug.wrongCurrency, debug.amountNot1, debug.expired);
    console.error('[verbose] 最终商品数: %s', products.length);
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
