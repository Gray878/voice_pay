import { Contract, JsonRpcProvider, Wallet, MaxUint256, getAddress } from 'ethers';
import { ERC20_ABI, ORDERBOOK_ABI } from '../contracts/abis';
import type { Order } from '../indexer/types';
import { randomBytes } from 'crypto';

export interface OrderMatchConfig {
  RPC_URL: string;
  RPC_ENDPOINTS?: string[];
  CHAIN_ID: number;
  ORDERBOOK_ADDRESS: string;
  USDOL_ADDRESS: string;
  WHIMLAND_PRIVATE_KEY: string;
}

export interface MatchOrderOptions {
  dryRun?: boolean;
  approveMax?: boolean;
}

export interface BuyOrder {
  side: number;
  saleKind: number;
  maker: string;
  nft: {
    tokenId: bigint;
    collectionAddr: string;
    amount: bigint;
  };
  price: bigint;
  currency: string;
  expiry: bigint;
  salt: bigint;
}

export async function ensureAllowance(
  cfg: OrderMatchConfig,
  wallet: Wallet,
  required: bigint,
  opts: MatchOrderOptions
): Promise<void> {
  const usdol = new Contract(cfg.USDOL_ADDRESS, ERC20_ABI, wallet);
  const owner = await wallet.getAddress();
  const current = await usdol.allowance(owner, cfg.ORDERBOOK_ADDRESS);
  if (current >= required) return;
  const amount = opts.approveMax ? MaxUint256 : required;
  if (opts.dryRun) return;
  const tx = await usdol.approve(cfg.ORDERBOOK_ADDRESS, amount);
  await tx.wait();
}

export function buildBuyOrderFromSell(sell: Order, buyer: string, ttlSec = 300): BuyOrder {
  const now = Math.floor(Date.now() / 1000);
  const salt = BigInt(`0x${cryptoRandomHex(8)}`);
  return {
    side: 1,
    saleKind: 1,
    maker: getAddress(buyer),
    nft: {
      tokenId: sell.nft.tokenId,
      collectionAddr: getAddress(sell.nft.collectionAddr),
      amount: 1n,
    },
    price: sell.price,
    currency: getAddress(sell.currency),
    expiry: BigInt(now + ttlSec),
    salt: salt === 0n ? 1n : salt,
  };
}

export async function matchOrder(cfg: OrderMatchConfig, sell: Order, opts: MatchOrderOptions): Promise<string | null> {
  const urls = Array.isArray(cfg.RPC_ENDPOINTS) && cfg.RPC_ENDPOINTS.length > 0 ? cfg.RPC_ENDPOINTS : [cfg.RPC_URL];
  const provider = await pickProvider(urls, cfg.CHAIN_ID);
  const wallet = new Wallet(cfg.WHIMLAND_PRIVATE_KEY, provider);
  const buyer = await wallet.getAddress();

  if (getAddress(sell.currency) !== getAddress(cfg.USDOL_ADDRESS)) {
    throw new Error(`Sell order currency is not USDOL: ${sell.currency}`);
  }

  await ensureAllowance(cfg, wallet, sell.price, opts);

  const ob = new Contract(cfg.ORDERBOOK_ADDRESS, ORDERBOOK_ABI, wallet);
  const buy = buildBuyOrderFromSell(sell, buyer);
  if (opts.dryRun) return null;
  const tx = await ob.matchOrder(sell, buy);
  const receipt = await tx.wait();
  if (!receipt) return tx.hash;
  if (receipt.status !== 1) {
    throw new Error('交易执行失败');
  }
  return tx.hash;
}

function cryptoRandomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

async function pickProvider(urls: string[], chainId: number): Promise<JsonRpcProvider> {
  for (const u of urls) {
    const p = new JsonRpcProvider(u, chainId);
    try {
      await p.getBlockNumber();
      return p;
    } catch (e) {
      void e;
    }
  }
  throw new Error('No healthy RPC endpoint');
}
