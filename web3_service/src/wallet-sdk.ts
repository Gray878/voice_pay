/**
 * WalletSDK - 钱包交互 SDK
 * 
 * 提供与 MetaMask 等 Web3 钱包的交互接口
 * Requirements: 7.1, 7.2, 7.4, 7.5, 7.6, 7.7
 * 
 * 注意：此模块设计用于浏览器环境，在 Node.js 环境中仅用于类型定义
 */

import { ethers } from 'ethers';

// 浏览器环境检查
const isBrowser = typeof window !== 'undefined';

// 钱包错误类型
export enum WalletErrorType {
  NOT_INSTALLED = 'NOT_INSTALLED',
  USER_REJECTED = 'USER_REJECTED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_PARAMS = 'INVALID_PARAMS',
  UNKNOWN = 'UNKNOWN'
}

// 标准化错误格式
export interface WalletError {
  type: WalletErrorType;
  message: string;
  originalError?: any;
}

// 钱包连接结果
export interface WalletConnection {
  address: string;
  chainId: number;
  provider: ethers.BrowserProvider;
}

// 网络配置
export interface NetworkConfig {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
}

/**
 * WalletSDK 类
 * 封装钱包交互逻辑，提供统一的错误处理
 */
export class WalletSDK {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private currentAddress: string | null = null;
  private currentChainId: number | null = null;

  /**
   * 检查钱包是否已安装
   */
  isWalletInstalled(): boolean {
    if (!isBrowser) return false;
    return typeof (window as any).ethereum !== 'undefined';
  }

  /**
   * 连接钱包
   * Requirements: 7.1, 7.2
   */
  async connect(): Promise<WalletConnection> {
    if (!isBrowser) {
      throw this.createError(
        WalletErrorType.NOT_INSTALLED,
        '此功能仅在浏览器环境中可用'
      );
    }

    try {
      // 检查钱包是否安装
      if (!this.isWalletInstalled()) {
        throw this.createError(
          WalletErrorType.NOT_INSTALLED,
          '未检测到 MetaMask 钱包，请先安装'
        );
      }

      const ethereum = (window as any).ethereum;

      // 请求账户访问权限
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts'
      }) as string[];

      if (!accounts || accounts.length === 0) {
        throw this.createError(
          WalletErrorType.USER_REJECTED,
          '用户拒绝连接钱包'
        );
      }

      // 创建 Provider 和 Signer
      this.provider = new ethers.BrowserProvider(ethereum);
      this.signer = await this.provider.getSigner();
      this.currentAddress = accounts[0];

      // 获取当前链 ID
      const network = await this.provider.getNetwork();
      this.currentChainId = Number(network.chainId);

      // 监听账户和网络变化
      this.setupEventListeners();

      return {
        address: this.currentAddress,
        chainId: this.currentChainId,
        provider: this.provider
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * 切换网络
   * Requirements: 7.4
   */
  async switchNetwork(chainId: number, networkConfig?: NetworkConfig): Promise<void> {
    if (!isBrowser) {
      throw this.createError(
        WalletErrorType.NOT_INSTALLED,
        '此功能仅在浏览器环境中可用'
      );
    }

    try {
      if (!this.isWalletInstalled()) {
        throw this.createError(
          WalletErrorType.NOT_INSTALLED,
          '未检测到钱包'
        );
      }

      const ethereum = (window as any).ethereum;
      const chainIdHex = `0x${chainId.toString(16)}`;

      try {
        // 尝试切换到目标网络
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }]
        });

        this.currentChainId = chainId;
      } catch (switchError: any) {
        // 如果网络不存在（错误码 4902），尝试添加网络
        if (switchError.code === 4902 && networkConfig) {
          await this.addNetwork(networkConfig);
          // 添加后再次尝试切换
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }]
          });
          this.currentChainId = chainId;
        } else {
          throw switchError;
        }
      }
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * 添加新网络
   * Requirements: 7.4
   */
  async addNetwork(config: NetworkConfig): Promise<void> {
    if (!isBrowser) {
      throw this.createError(
        WalletErrorType.NOT_INSTALLED,
        '此功能仅在浏览器环境中可用'
      );
    }

    try {
      const ethereum = (window as any).ethereum;
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [config]
      });
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * 签名并发送交易
   * Requirements: 7.5
   */
  async signTransaction(transaction: ethers.TransactionRequest): Promise<string> {
    try {
      if (!this.signer) {
        throw this.createError(
          WalletErrorType.INVALID_PARAMS,
          '钱包未连接，请先调用 connect()'
        );
      }

      // 验证交易参数
      if (!transaction.to) {
        throw this.createError(
          WalletErrorType.INVALID_PARAMS,
          '交易缺少接收地址'
        );
      }

      // 发送交易
      const txResponse = await this.signer.sendTransaction(transaction);
      
      return txResponse.hash;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * 获取账户余额
   * Requirements: 7.6
   */
  async getBalance(address?: string): Promise<string> {
    try {
      if (!this.provider) {
        throw this.createError(
          WalletErrorType.INVALID_PARAMS,
          '钱包未连接，请先调用 connect()'
        );
      }

      const targetAddress = address || this.currentAddress;
      if (!targetAddress) {
        throw this.createError(
          WalletErrorType.INVALID_PARAMS,
          '未指定查询地址'
        );
      }

      const balance = await this.provider.getBalance(targetAddress);
      return ethers.formatEther(balance);
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * 获取 Token 余额
   * Requirements: 7.6
   */
  async getTokenBalance(tokenAddress: string, userAddress?: string): Promise<string> {
    try {
      if (!this.provider) {
        throw this.createError(
          WalletErrorType.INVALID_PARAMS,
          '钱包未连接'
        );
      }

      const targetAddress = userAddress || this.currentAddress;
      if (!targetAddress) {
        throw this.createError(
          WalletErrorType.INVALID_PARAMS,
          '未指定查询地址'
        );
      }

      // ERC20 balanceOf ABI
      const erc20Abi = [
        'function balanceOf(address owner) view returns (uint256)'
      ];

      const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      const balance = await contract.balanceOf(targetAddress);
      
      return ethers.formatUnits(balance, 18); // 默认 18 位小数
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * 获取当前连接的地址
   */
  getCurrentAddress(): string | null {
    return this.currentAddress;
  }

  /**
   * 获取当前链 ID
   */
  getCurrentChainId(): number | null {
    return this.currentChainId;
  }

  /**
   * 获取 Provider
   */
  getProvider(): ethers.BrowserProvider | null {
    return this.provider;
  }

  /**
   * 获取 Signer
   */
  getSigner(): ethers.Signer | null {
    return this.signer;
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.provider = null;
    this.signer = null;
    this.currentAddress = null;
    this.currentChainId = null;
  }

  /**
   * 设置事件监听器
   * 监听账户和网络变化
   */
  private setupEventListeners(): void {
    if (!isBrowser) return;

    const ethereum = (window as any).ethereum;
    if (!ethereum) return;

    // 监听账户变化
    ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        // 用户断开连接
        this.disconnect();
      } else {
        this.currentAddress = accounts[0];
      }
    });

    // 监听网络变化
    ethereum.on('chainChanged', (chainId: string) => {
      this.currentChainId = parseInt(chainId, 16);
      // 网络变化时重新加载页面（推荐做法）
      if (isBrowser && (window as any).location) {
        (window as any).location.reload();
      }
    });
  }

  /**
   * 创建标准化错误
   * Requirements: 7.7
   */
  private createError(type: WalletErrorType, message: string, originalError?: any): WalletError {
    return {
      type,
      message,
      originalError
    };
  }

  /**
   * 处理错误并转换为标准格式
   * Requirements: 7.7
   */
  private handleError(error: any): WalletError {
    // 用户拒绝操作
    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      return this.createError(
        WalletErrorType.USER_REJECTED,
        '用户拒绝了操作',
        error
      );
    }

    // 网络错误
    if (error.code === 'NETWORK_ERROR' || error.code === -32603) {
      return this.createError(
        WalletErrorType.NETWORK_ERROR,
        '网络连接失败，请检查网络设置',
        error
      );
    }

    // 参数错误
    if (error.code === -32602 || error.code === 'INVALID_ARGUMENT') {
      return this.createError(
        WalletErrorType.INVALID_PARAMS,
        '交易参数无效',
        error
      );
    }

    // 已经是 WalletError 格式
    if (error.type && error.message) {
      return error;
    }

    // 未知错误
    return this.createError(
      WalletErrorType.UNKNOWN,
      error.message || '未知错误',
      error
    );
  }
}

// 导出单例实例
export const walletSDK = new WalletSDK();

// 扩展 Window 接口以支持 ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}
