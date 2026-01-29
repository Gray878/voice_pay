// 订单簿索引器类型定义

export interface NFTInfo {
  tokenId: bigint;
  collectionAddr: string;
  amount: bigint;
}

export interface Order {
  side: number;
  saleKind: number;
  maker: string;
  nft: NFTInfo;
  price: bigint;
  currency: string;
  expiry: bigint;
  salt: bigint;
}

export interface PersistedOrder {
  side: number;
  saleKind: number;
  maker: string;
  nft: {
    tokenId: string;
    collectionAddr: string;
    amount: string;
  };
  price: string;
  currency: string;
  expiry: string;
  salt: string;
}

export interface IndexedOrder {
  orderKey: string;
  order: PersistedOrder;
  status: 'open' | 'cancelled' | 'filled';
  firstSeenBlock: number;
  lastUpdateBlock: number;
}

export interface IndexState {
  chainId: number;
  orderbook: string;
  lastScannedBlock: number;
  ordersByKey: Record<string, IndexedOrder>;
}
