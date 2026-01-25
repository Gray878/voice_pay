// 前端类型定义

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: string;
  chain: string;
  contract_address: string;
  image_url?: string;
  category?: string;
}

export interface TransactionState {
  status: 'idle' | 'processing' | 'pending' | 'success' | 'error' | 'confirmation';
  message: string;
  txHash?: string;
}

export interface WalletInfo {
  address: string;
  chainId: number;
  balance?: string;
}
