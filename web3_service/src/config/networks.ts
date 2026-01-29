/**
 * 多测试网配置
 * 支持 Sepolia, Base, Optimism, Arbitrum, BSC 测试网
 */

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer: string;
  faucets: string[];
  features: string[];
}

export const NETWORKS: Record<string, NetworkConfig> = {
  'sepolia': {
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18
    },
    blockExplorer: 'https://sepolia.etherscan.io',
    faucets: [
      'https://sepoliafaucet.com',
      'https://www.alchemy.com/faucets/ethereum-sepolia'
    ],
    features: ['最稳定', '官方测试网', '文档完善']
  },
  
  'base-sepolia': {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    nativeCurrency: {
      name: 'Base Sepolia ETH',
      symbol: 'ETH',
      decimals: 18
    },
    blockExplorer: 'https://sepolia.basescan.org',
    faucets: [
      'https://www.coinbase.com/faucets/base-ethereum-goerli-faucet',
      'https://www.alchemy.com/faucets/base-sepolia'
    ],
    features: ['Layer 2', '低成本', 'Coinbase 生态', '推荐']
  },
  
  'optimism-sepolia': {
    name: 'Optimism Sepolia',
    chainId: 11155420,
    rpcUrl: process.env.OPTIMISM_SEPOLIA_RPC_URL || 'https://sepolia.optimism.io',
    nativeCurrency: {
      name: 'Optimism Sepolia ETH',
      symbol: 'ETH',
      decimals: 18
    },
    blockExplorer: 'https://sepolia-optimism.etherscan.io',
    faucets: [
      'https://app.optimism.io/faucet',
      'https://www.alchemy.com/faucets/optimism-sepolia'
    ],
    features: ['Layer 2', '交易成本极低', '高性能']
  },
  
  'arbitrum-sepolia': {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
    nativeCurrency: {
      name: 'Arbitrum Sepolia ETH',
      symbol: 'ETH',
      decimals: 18
    },
    blockExplorer: 'https://sepolia.arbiscan.io',
    faucets: [
      'https://faucet.quicknode.com/arbitrum/sepolia',
      'https://www.alchemy.com/faucets/arbitrum-sepolia'
    ],
    features: ['Layer 2', '高性能', '低延迟']
  },
  
  'bsc-testnet': {
    name: 'BSC Testnet',
    chainId: 97,
    rpcUrl: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
    nativeCurrency: {
      name: 'Test BNB',
      symbol: 'tBNB',
      decimals: 18
    },
    blockExplorer: 'https://testnet.bscscan.com',
    faucets: [
      'https://testnet.bnbchain.org/faucet-smart'
    ],
    features: ['交易速度快', 'Gas 费低', 'Binance 生态']
  },
  
  'polygon-amoy': {
    name: 'Polygon Amoy',
    chainId: 80002,
    rpcUrl: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
    nativeCurrency: {
      name: 'Test MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    blockExplorer: 'https://amoy.polygonscan.com',
    faucets: [
      'https://faucet.polygon.technology'
    ],
    features: ['Polygon 新测试网', '替代 Mumbai']
  }
};

/**
 * 获取当前网络配置
 */
export function getCurrentNetwork(): NetworkConfig {
  const networkName = process.env.NETWORK || 'base-sepolia';
  const network = NETWORKS[networkName];
  
  if (!network) {
    throw new Error(`Unknown network: ${networkName}. Available: ${Object.keys(NETWORKS).join(', ')}`);
  }
  
  return network;
}

/**
 * 获取网络信息摘要
 */
export function getNetworkSummary(): string {
  const network = getCurrentNetwork();
  return `
🌐 当前网络: ${network.name}
📍 Chain ID: ${network.chainId}
🔗 RPC: ${network.rpcUrl}
💰 原生代币: ${network.nativeCurrency.symbol}
🔍 区块浏览器: ${network.blockExplorer}
✨ 特性: ${network.features.join(', ')}
💧 水龙头: ${network.faucets.join(', ')}
  `.trim();
}

/**
 * 验证网络连接
 */
export async function validateNetwork(): Promise<boolean> {
  const network = getCurrentNetwork();
  
  try {
    const response = await fetch(network.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1
      })
    });
    
    const data = await response.json();
    const chainId = parseInt(data.result, 16);
    
    if (chainId !== network.chainId) {
      console.error(`❌ Chain ID 不匹配: 期望 ${network.chainId}, 实际 ${chainId}`);
      return false;
    }
    
    console.log(`✅ 网络连接成功: ${network.name} (Chain ID: ${chainId})`);
    return true;
  } catch (error) {
    console.error(`❌ 网络连接失败:`, error);
    return false;
  }
}
