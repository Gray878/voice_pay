/**
 * AssetActivator - 资产激活模块
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 * 
 * 功能：
 * - 查询用户钱包中的新资产
 * - 检查资产是否需要激活
 * - 执行资产激活操作
 * - 更新交易记录
 */

import { ethers } from 'ethers';
import { WalletSDK } from './wallet-sdk';
import { TransactionModule, TransactionParams } from './transaction-module';

// 资产信息接口
export interface AssetInfo {
  tokenAddress: string;
  tokenId?: string; // NFT 的 tokenId
  tokenType: 'ERC20' | 'ERC721' | 'ERC1155';
  balance: string;
  name?: string;
  symbol?: string;
  requiresActivation: boolean;
  activationContract?: string;
}

// 激活状态
export enum ActivationStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  REQUIRED = 'REQUIRED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// 激活结果
export interface ActivationResult {
  status: ActivationStatus;
  transactionHash?: string;
  message: string;
  gasUsed?: string;
}

// 激活配置
export interface ActivationConfig {
  contractAddress: string;
  methodName: string;
  abi: string[];
  gasLimit?: string;
}

export class AssetActivator {
  private walletSDK: WalletSDK;
  private transactionModule: TransactionModule;
  private activationConfigs: Map<string, ActivationConfig>;

  constructor(walletSDK: WalletSDK, transactionModule: TransactionModule) {
    this.walletSDK = walletSDK;
    this.transactionModule = transactionModule;
    this.activationConfigs = new Map();
    
    // 初始化默认激活配置
    this.initializeDefaultConfigs();
  }

  /**
   * 初始化默认激活配置
   * 可以根据不同的资产类型配置不同的激活合约
   */
  private initializeDefaultConfigs(): void {
    // 示例：通用 ERC20 激活配置
    this.activationConfigs.set('ERC20_DEFAULT', {
      contractAddress: '0x0000000000000000000000000000000000000000', // 占位符
      methodName: 'activate',
      abi: [
        'function activate(address tokenAddress) external returns (bool)'
      ],
      gasLimit: '100000'
    });
  }

  /**
   * 添加自定义激活配置
   * Requirements: 10.3
   */
  addActivationConfig(key: string, config: ActivationConfig): void {
    this.activationConfigs.set(key, config);
  }

  /**
   * 查询用户钱包中的资产
   * Requirements: 10.1
   */
  async queryAsset(tokenAddress: string, tokenType: 'ERC20' | 'ERC721' | 'ERC1155' = 'ERC20'): Promise<AssetInfo> {
    try {
      const provider = this.walletSDK.getProvider();
      const userAddress = this.walletSDK.getCurrentAddress();

      if (!provider || !userAddress) {
        throw new Error('钱包未连接');
      }

      let balance = '0';
      let name: string | undefined;
      let symbol: string | undefined;

      if (tokenType === 'ERC20') {
        // 查询 ERC20 余额
        const erc20Abi = [
          'function balanceOf(address owner) view returns (uint256)',
          'function name() view returns (string)',
          'function symbol() view returns (string)'
        ];

        const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
        
        const balanceRaw = await contract.balanceOf(userAddress);
        balance = ethers.formatUnits(balanceRaw, 18);

        try {
          name = await contract.name();
          symbol = await contract.symbol();
        } catch {
          // 某些代币可能不支持 name/symbol
        }
      } else if (tokenType === 'ERC721') {
        // 查询 ERC721 余额
        const erc721Abi = [
          'function balanceOf(address owner) view returns (uint256)',
          'function name() view returns (string)',
          'function symbol() view returns (string)'
        ];

        const contract = new ethers.Contract(tokenAddress, erc721Abi, provider);
        const balanceRaw = await contract.balanceOf(userAddress);
        balance = balanceRaw.toString();

        try {
          name = await contract.name();
          symbol = await contract.symbol();
        } catch {
          // 忽略
        }
      }

      // 检查是否需要激活
      const requiresActivation = await this.checkActivationRequired(tokenAddress, tokenType);

      return {
        tokenAddress,
        tokenType,
        balance,
        name,
        symbol,
        requiresActivation,
        activationContract: requiresActivation ? this.getActivationContract(tokenType) : undefined
      };
    } catch (error: any) {
      throw new Error(`查询资产失败: ${error.message}`);
    }
  }

  /**
   * 检查资产是否需要激活
   * Requirements: 10.2
   */
  async checkActivationRequired(tokenAddress: string, tokenType: 'ERC20' | 'ERC721' | 'ERC1155'): Promise<boolean> {
    try {
      const provider = this.walletSDK.getProvider();
      const userAddress = this.walletSDK.getCurrentAddress();

      if (!provider || !userAddress) {
        return false;
      }

      // 获取激活配置
      const configKey = `${tokenType}_DEFAULT`;
      const config = this.activationConfigs.get(configKey);

      if (!config || config.contractAddress === '0x0000000000000000000000000000000000000000') {
        // 没有配置激活合约，说明不需要激活
        return false;
      }

      // 查询激活状态
      const checkAbi = [
        'function isActivated(address user, address token) view returns (bool)'
      ];

      const contract = new ethers.Contract(config.contractAddress, checkAbi, provider);
      
      try {
        const isActivated = await contract.isActivated(userAddress, tokenAddress);
        return !isActivated; // 如果未激活，返回 true（需要激活）
      } catch {
        // 如果合约不支持 isActivated 方法，假设不需要激活
        return false;
      }
    } catch (error: any) {
      console.warn(`检查激活状态失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 激活资产
   * Requirements: 10.3, 10.4
   */
  async activateAsset(tokenAddress: string, tokenType: 'ERC20' | 'ERC721' | 'ERC1155' = 'ERC20'): Promise<ActivationResult> {
    try {
      // 检查是否需要激活
      const requiresActivation = await this.checkActivationRequired(tokenAddress, tokenType);

      if (!requiresActivation) {
        return {
          status: ActivationStatus.NOT_REQUIRED,
          message: '该资产不需要激活'
        };
      }

      // 获取激活配置
      const configKey = `${tokenType}_DEFAULT`;
      const config = this.activationConfigs.get(configKey);

      if (!config) {
        throw new Error(`未找到 ${tokenType} 的激活配置`);
      }

      // 构造激活交易数据
      const iface = new ethers.Interface(config.abi);
      const data = iface.encodeFunctionData(config.methodName, [tokenAddress]);

      // 发送激活交易
      const txParams: TransactionParams = {
        to: config.contractAddress,
        data,
        gasLimit: config.gasLimit
      };

      const txResult = await this.transactionModule.sendTransaction(txParams);

      return {
        status: ActivationStatus.COMPLETED,
        transactionHash: txResult.hash,
        message: '资产激活成功',
        gasUsed: txResult.gasLimit
      };
    } catch (error: any) {
      return {
        status: ActivationStatus.FAILED,
        message: `资产激活失败: ${error.message}`
      };
    }
  }

  /**
   * 批量查询多个资产
   * Requirements: 10.1
   */
  async queryMultipleAssets(tokens: Array<{ address: string; type: 'ERC20' | 'ERC721' | 'ERC1155' }>): Promise<AssetInfo[]> {
    const results: AssetInfo[] = [];

    for (const token of tokens) {
      try {
        const assetInfo = await this.queryAsset(token.address, token.type);
        results.push(assetInfo);
      } catch (error: any) {
        console.error(`查询资产 ${token.address} 失败:`, error.message);
        // 继续查询其他资产
      }
    }

    return results;
  }

  /**
   * 批量激活多个资产
   * Requirements: 10.3
   */
  async activateMultipleAssets(tokens: Array<{ address: string; type: 'ERC20' | 'ERC721' | 'ERC1155' }>): Promise<ActivationResult[]> {
    const results: ActivationResult[] = [];

    for (const token of tokens) {
      try {
        const result = await this.activateAsset(token.address, token.type);
        results.push(result);
      } catch (error: any) {
        results.push({
          status: ActivationStatus.FAILED,
          message: `激活 ${token.address} 失败: ${error.message}`
        });
      }
    }

    return results;
  }

  /**
   * 获取激活合约地址
   */
  private getActivationContract(tokenType: string): string | undefined {
    const config = this.activationConfigs.get(`${tokenType}_DEFAULT`);
    return config?.contractAddress;
  }

  /**
   * 更新交易记录（与数据库集成）
   * Requirements: 10.5
   * 
   * 注意：此方法需要与数据库模块集成，当前仅返回格式化的记录对象
   */
  async updateTransactionRecord(
    transactionHash: string,
    tokenAddress: string,
    status: ActivationStatus
  ): Promise<any> {
    const record = {
      tx_hash: transactionHash,
      token_address: tokenAddress,
      activation_status: status,
      updated_at: new Date().toISOString()
    };

    // TODO: 集成数据库模块，将记录写入 PostgreSQL
    console.log('交易记录更新:', record);

    return record;
  }

  /**
   * 获取资产激活历史
   * Requirements: 10.5
   */
  async getActivationHistory(userAddress?: string): Promise<any[]> {
    const address = userAddress || this.walletSDK.getCurrentAddress();
    
    if (!address) {
      throw new Error('未指定用户地址');
    }

    // TODO: 从数据库查询激活历史
    console.log(`查询用户 ${address} 的激活历史`);

    return [];
  }
}
