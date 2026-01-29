import { Contract, JsonRpcProvider, parseUnits, formatUnits } from 'ethers';
import { ERC20_ABI } from '../contracts/abis';

const decimalsCache = new Map<string, number>();

export async function getErc20Decimals(provider: JsonRpcProvider, tokenAddress: string): Promise<number> {
  const key = tokenAddress.toLowerCase();
  const cached = decimalsCache.get(key);
  if (cached != null) return cached;
  const token = new Contract(tokenAddress, ERC20_ABI, provider);
  const d = Number(await token.decimals());
  if (!Number.isFinite(d) || d < 0 || d > 255) {
    throw new Error(`Invalid decimals() for ${tokenAddress}: ${d}`);
  }
  decimalsCache.set(key, d);
  return d;
}

export async function parseUsdOLAmount(
  rpcUrl: string,
  chainId: number,
  tokenAddress: string,
  human: string
): Promise<bigint> {
  const provider = new JsonRpcProvider(rpcUrl, chainId);
  const decimals = await getErc20Decimals(provider, tokenAddress);
  return parseDecimalToUnits(human, decimals);
}

export function parseDecimalToUnits(human: string, decimals: number): bigint {
  const cleaned = human.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error(`Invalid amount: "${human}"`);
  }
  return parseUnits(cleaned, decimals);
}

export function formatUnitsHuman(amount: bigint, decimals: number): string {
  return formatUnits(amount, decimals);
}
