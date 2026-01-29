import { JsonRpcProvider, getAddress } from 'ethers';
import { getErc20Decimals, parseDecimalToUnits } from '../trading/pricing';
import type { Order } from '../indexer/types';

export interface RiskConfig {
  RPC_URL: string;
  RPC_ENDPOINTS?: string[];
  CHAIN_ID: number;
  USDOL_ADDRESS: string;
  MAX_QTY: number;
  COLLECTION_ALLOWLIST?: string;
}

export interface RiskIntent {
  quantity: number;
  maxUnitPriceUsdOL?: string;
  maxTotalUsdOL?: string;
  maxUnitPriceRaw?: bigint;
  maxTotalRaw?: bigint;
}

export class RiskChecker {
  private cfg: RiskConfig;
  private urls: string[];

  constructor(cfg: RiskConfig) {
    this.cfg = cfg;
    this.urls = Array.isArray(cfg.RPC_ENDPOINTS) && cfg.RPC_ENDPOINTS.length > 0 ? cfg.RPC_ENDPOINTS : [cfg.RPC_URL];
  }

  private async pickProvider(): Promise<JsonRpcProvider> {
    for (const u of this.urls) {
      const p = new JsonRpcProvider(u, this.cfg.CHAIN_ID);
      try {
        await p.getBlockNumber();
        return p;
      } catch (e) {
        void e;
      }
    }
    throw new Error('No healthy RPC endpoint');
  }

  async checkRisk(intent: RiskIntent, selectedOrders: Array<{ order: Order }>): Promise<void> {
    if (intent.quantity > this.cfg.MAX_QTY) {
      throw new Error(`quantity=${intent.quantity} exceeds MAX_QTY=${this.cfg.MAX_QTY}`);
    }

    const allowlist = parseAllowlist(this.cfg.COLLECTION_ALLOWLIST);
    if (allowlist.size > 0) {
      for (const o of selectedOrders) {
        const c = getAddress(o.order.nft.collectionAddr).toLowerCase();
        if (!allowlist.has(c)) {
          throw new Error(`collection not allowed: ${o.order.nft.collectionAddr}`);
        }
      }
    }

    if (intent.maxUnitPriceRaw != null) {
      for (const o of selectedOrders) {
        if (o.order.price > intent.maxUnitPriceRaw) {
          throw new Error(`price ${o.order.price.toString()} exceeds maxUnitPriceRaw ${intent.maxUnitPriceRaw.toString()}`);
        }
      }
    }

    if (intent.maxTotalRaw != null) {
      const total = selectedOrders.reduce((acc, o) => acc + o.order.price, 0n);
      if (total > intent.maxTotalRaw) {
        throw new Error(`total ${total.toString()} exceeds maxTotalRaw ${intent.maxTotalRaw.toString()}`);
      }
    }

    if (intent.maxUnitPriceUsdOL || intent.maxTotalUsdOL) {
      const provider = await this.pickProvider();
      const usdolDecimals = await getErc20Decimals(provider, this.cfg.USDOL_ADDRESS);

      if (intent.maxUnitPriceUsdOL) {
        const maxUnit = parseDecimalToUnits(intent.maxUnitPriceUsdOL, usdolDecimals);
        for (const o of selectedOrders) {
          if (o.order.price > maxUnit) {
            throw new Error(`price ${o.order.price.toString()} exceeds maxUnitPriceUsdOL ${maxUnit.toString()}`);
          }
        }
      }

      if (intent.maxTotalUsdOL) {
        const maxTotal = parseDecimalToUnits(intent.maxTotalUsdOL, usdolDecimals);
        const total = selectedOrders.reduce((acc, o) => acc + o.order.price, 0n);
        if (total > maxTotal) {
          throw new Error(`total ${total.toString()} exceeds maxTotalUsdOL ${maxTotal.toString()}`);
        }
      }
    }
  }
}

 

function parseAllowlist(raw: string | undefined): Set<string> {
  const set = new Set<string>();
  if (!raw) return set;
  const parts = raw
    .split(/[,\s]+/g)
    .map(s => s.trim())
    .filter(Boolean);
  for (const p of parts) {
    if (/^0x[0-9a-fA-F]{40}$/.test(p)) {
      set.add(p.toLowerCase());
    }
  }
  return set;
}
