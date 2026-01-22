import { ethers } from 'ethers';

export interface ChainMetrics {
  chainId: number;
  gasPrice: string;
  congestion: number;
  blockTime: number;
}

export interface OptimizationResult {
  recommendedChain: number;
  estimatedGas: string;
  estimatedTime: number;
  reason: string;
}

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  nativeCurrency: string;
  blockTime: number;
}

export class ChainOptimizer {
  private chainConfigs: Map<number, ChainConfig> = new Map();

  constructor() {
    this.initializeChainConfigs();
  }

  private initializeChainConfigs(): void {
    this.chainConfigs.set(80001, {
      chainId: 80001,
      name: 'Polygon Mumbai',
      rpcUrl: 'https://rpc-mumbai.maticvigil.com',
      nativeCurrency: 'MATIC',
      blockTime: 2
    });

    this.chainConfigs.set(137, {
      chainId: 137,
      name: 'Polygon',
      rpcUrl: 'https://polygon-rpc.com',
      nativeCurrency: 'MATIC',
      blockTime: 2
    });

    this.chainConfigs.set(1, {
      chainId: 1,
      name: 'Ethereum',
      rpcUrl: 'https://eth.llamarpc.com',
      nativeCurrency: 'ETH',
      blockTime: 12
    });
  }

  async getChainMetrics(chainId: number): Promise<ChainMetrics> {
    const config = this.chainConfigs.get(chainId);
    if (!config) {
      throw new Error(`不支持的链 ID: ${chainId}`);
    }

    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') : '0';

      return {
        chainId,
        gasPrice,
        congestion: parseFloat(gasPrice) > 50 ? 0.8 : 0.3,
        blockTime: config.blockTime
      };
    } catch (error) {
      console.warn(`获取链 ${chainId} 指标失败:`, error);
      return {
        chainId,
        gasPrice: '0',
        congestion: 0.5,
        blockTime: config.blockTime
      };
    }
  }

  async optimizeTransaction(
    supportedChains: number[],
    transactionValue: string
  ): Promise<OptimizationResult> {
    const metrics = await Promise.all(
      supportedChains.map(chainId => this.getChainMetrics(chainId))
    );

    let bestChain = metrics[0];
    let bestScore = -Infinity;

    for (const metric of metrics) {
      const gasCost = parseFloat(metric.gasPrice) * 21000;
      const timeScore = 100 / metric.blockTime;
      const congestionScore = (1 - metric.congestion) * 50;
      const score = timeScore + congestionScore - gasCost * 0.1;

      if (score > bestScore) {
        bestScore = score;
        bestChain = metric;
      }
    }

    return {
      recommendedChain: bestChain.chainId,
      estimatedGas: (parseFloat(bestChain.gasPrice) * 21000 / 1e9).toFixed(6),
      estimatedTime: bestChain.blockTime * 3,
      reason: `Gas 价格: ${bestChain.gasPrice} Gwei, 拥堵度: ${(bestChain.congestion * 100).toFixed(0)}%`
    };
  }

  async estimateGas(chainId: number, gasLimit: number = 21000): Promise<string> {
    const metrics = await this.getChainMetrics(chainId);
    const gasCost = parseFloat(metrics.gasPrice) * gasLimit / 1e9;
    return gasCost.toFixed(6);
  }

  getChainConfig(chainId: number): ChainConfig | undefined {
    return this.chainConfigs.get(chainId);
  }

  getSupportedChains(): number[] {
    return Array.from(this.chainConfigs.keys());
  }
}
