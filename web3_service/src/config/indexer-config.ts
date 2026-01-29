/**
 * 订单簿索引器配置
 */

import { IndexerConfig } from '../indexer/orderbook-indexer';

export function loadIndexerConfig(): IndexerConfig {
  const rawUrls =
    process.env.EVM_RPC_ENDPOINTS ||
    process.env.EVM_RPC_URLS ||
    process.env.WHIMLAND_RPC_ENDPOINTS ||
    process.env.WHIMLAND_RPC_URLS ||
    '';
  const urls = rawUrls
    .split(/[,\s]+/g)
    .map(s => s.trim())
    .filter(Boolean);
  return {
    RPC_URL: urls[0] || process.env.EVM_RPC_URL || process.env.WHIMLAND_RPC_URL || '',
    RPC_ENDPOINTS: urls.length > 0 ? urls : undefined,
    CHAIN_ID: parseInt(process.env.EVM_CHAIN_ID || process.env.WHIMLAND_CHAIN_ID || '0'),
    ORDERBOOK_ADDRESS: process.env.ORDERBOOK_ADDRESS || '',
    USDOL_ADDRESS: process.env.USDOL_ADDRESS || '',
    INDEX_PATH: process.env.INDEX_PATH || './data/index.json',
    INDEXER_FROM_BLOCK: parseInt(process.env.INDEX_FROM_BLOCK || '0'),
    COLLECTION_ALLOWLIST: process.env.COLLECTION_ALLOWLIST,
  };
}

export function validateIndexerConfig(config: IndexerConfig): void {
  if (!config.RPC_URL) {
    throw new Error('RPC_URL is required');
  }
  if (!config.ORDERBOOK_ADDRESS) {
    throw new Error('ORDERBOOK_ADDRESS is required');
  }
  if (!config.USDOL_ADDRESS) {
    throw new Error('USDOL_ADDRESS is required');
  }
}
