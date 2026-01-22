/**
 * TransactionModule - 链上交易模块
 * Requirements: 8.1, 8.2, 8.4, 8.5, 8.6, 8.7
 */

import { ethers } from 'ethers';
import { WalletSDK } from './wallet-sdk';

export interface TransactionParams {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface GasEstimate {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  estimatedCost: string;
}

export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasLimit: string;
  timestamp: number;
}

export enum TransactionErrorType {
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  SECURITY_CHECK_FAILED = 'SECURITY_CHECK_FAILED',
  UNKNOWN = 'UNKNOWN'
}

export interface TransactionError {
  type: TransactionErrorType;
  message: string;
  originalError?: any;
}

export class TransactionModule {
  private walletSDK: WalletSDK;
  private securityValidator?: any;

  constructor(walletSDK: WalletSDK, securityValidator?: any) {
    this.walletSDK = walletSDK;
    this.securityValidator = securityValidator;
  }

  validateContract(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  normalizeAddress(address: string): string {
    if (!this.validateContract(address)) {
      throw this.createError(
        TransactionErrorType.INVALID_ADDRESS,
        `无效的地址格式: ${address}`
      );
    }
    return ethers.getAddress(address);
  }

  async estimateGas(params: TransactionParams): Promise<GasEstimate> {
    try {
      const provider = this.walletSDK.getProvider();
      if (!provider) {
        throw this.createError(
          TransactionErrorType.GAS_ESTIMATION_FAILED,
          '钱包未连接'
        );
      }

      const toAddress = this.normalizeAddress(params.to);
      const transaction: ethers.TransactionRequest = {
        to: toAddress,
        value: params.value ? ethers.parseEther(params.value) : undefined,
        data: params.data || '0x'
      };

      const gasLimit = await provider.estimateGas(transaction);
      const feeData = await provider.getFeeData();
      
      if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
        throw this.createError(
          TransactionErrorType.GAS_ESTIMATION_FAILED,
          '无法获取 Gas 价格数据'
        );
      }

      const estimatedCost = gasLimit * feeData.maxFeePerGas;
      const estimatedCostEther = ethers.formatEther(estimatedCost);

      return {
        gasLimit,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        estimatedCost: estimatedCostEther
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  private async performSecurityCheck(toAddress: string, value: string): Promise<void> {
    if (!this.securityValidator) return;

    try {
      const isValid = await this.securityValidator.validateContract(toAddress);
      if (!isValid) {
        throw this.createError(
          TransactionErrorType.SECURITY_CHECK_FAILED,
          '目标地址未通过安全检查'
        );
      }
    } catch (error: any) {
      if (error.type === TransactionErrorType.SECURITY_CHECK_FAILED) {
        throw error;
      }
      console.warn('安全检查失败:', error.message);
    }
  }

  async sendTransaction(params: TransactionParams): Promise<TransactionResult> {
    try {
      const toAddress = this.normalizeAddress(params.to);

      if (params.value) {
        await this.performSecurityCheck(toAddress, params.value);
      }

      let gasEstimate: GasEstimate | undefined;
      if (!params.gasLimit) {
        gasEstimate = await this.estimateGas(params);
      }

      const transaction: ethers.TransactionRequest = {
        to: toAddress,
        value: params.value ? ethers.parseEther(params.value) : undefined,
        data: params.data || '0x',
        gasLimit: params.gasLimit ? BigInt(params.gasLimit) : gasEstimate?.gasLimit,
        maxFeePerGas: params.maxFeePerGas ? BigInt(params.maxFeePerGas) : gasEstimate?.maxFeePerGas,
        maxPriorityFeePerGas: params.maxPriorityFeePerGas ? BigInt(params.maxPriorityFeePerGas) : gasEstimate?.maxPriorityFeePerGas
      };

      const txHash = await this.walletSDK.signTransaction(transaction);
      const fromAddress = this.walletSDK.getCurrentAddress();
      
      if (!fromAddress) {
        throw this.createError(
          TransactionErrorType.TRANSACTION_FAILED,
          '无法获取发送地址'
        );
      }

      return {
        hash: txHash,
        from: fromAddress,
        to: toAddress,
        value: params.value || '0',
        gasLimit: transaction.gasLimit?.toString() || '0',
        timestamp: Date.now()
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async checkSufficientBalance(requiredAmount: string): Promise<boolean> {
    try {
      const balance = await this.walletSDK.getBalance();
      const balanceBigInt = ethers.parseEther(balance);
      const requiredBigInt = ethers.parseEther(requiredAmount);
      return balanceBigInt >= requiredBigInt;
    } catch {
      return false;
    }
  }

  private createError(type: TransactionErrorType, message: string, originalError?: any): TransactionError {
    return { type, message, originalError };
  }

  private handleError(error: any): TransactionError {
    if (error.code === 'INSUFFICIENT_FUNDS' || error.message?.includes('insufficient funds')) {
      return this.createError(TransactionErrorType.INSUFFICIENT_FUNDS, '账户余额不足', error);
    }
    if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      return this.createError(TransactionErrorType.GAS_ESTIMATION_FAILED, 'Gas 估算失败', error);
    }
    if (error.type) return error;
    return this.createError(TransactionErrorType.UNKNOWN, error.message || '交易失败', error);
  }
}
