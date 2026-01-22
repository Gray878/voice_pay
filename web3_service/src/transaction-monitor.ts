/**
 * TransactionMonitor - 交易状态监听器
 * Requirements: 9.1, 9.2, 9.3, 9.5, 9.7
 */

import { ethers } from 'ethers';
import { WalletSDK } from './wallet-sdk';

export enum TxStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT'
}

export interface TransactionReceipt {
  hash: string;
  status: TxStatus;
  blockNumber?: number;
  gasUsed?: string;
  effectiveGasPrice?: string;
  failureReason?: string;
  confirmations?: number;
}

export type StatusCallback = (receipt: TransactionReceipt) => void;

export class TransactionMonitor {
  private walletSDK: WalletSDK;
  private pollInterval: number = 3000; // 3秒轮询间隔
  private timeout: number = 300000; // 5分钟超时
  private activeMonitors: Map<string, NodeJS.Timeout> = new Map();

  constructor(walletSDK: WalletSDK) {
    this.walletSDK = walletSDK;
  }

  async waitForConfirmation(
    txHash: string,
    onStatusChange?: StatusCallback,
    requiredConfirmations: number = 1
  ): Promise<TransactionReceipt> {
    const provider = this.walletSDK.getProvider();
    if (!provider) {
      throw new Error('钱包未连接');
    }

    const startTime = Date.now();

    // 初始状态回调
    if (onStatusChange) {
      onStatusChange({
        hash: txHash,
        status: TxStatus.PENDING
      });
    }

    return new Promise((resolve, reject) => {
      const pollStatus = async () => {
        try {
          // 检查超时
          if (Date.now() - startTime > this.timeout) {
            this.stopMonitoring(txHash);
            const timeoutReceipt: TransactionReceipt = {
              hash: txHash,
              status: TxStatus.TIMEOUT,
              failureReason: '交易确认超时'
            };
            if (onStatusChange) onStatusChange(timeoutReceipt);
            resolve(timeoutReceipt);
            return;
          }

          // 查询交易回执
          const receipt = await provider.getTransactionReceipt(txHash);

          if (!receipt) {
            // 交易仍在 pending
            return;
          }

          // 检查确认数
          const currentBlock = await provider.getBlockNumber();
          const confirmations = currentBlock - receipt.blockNumber + 1;

          if (confirmations < requiredConfirmations) {
            // 等待更多确认
            return;
          }

          // 停止监听
          this.stopMonitoring(txHash);

          // 解析交易状态
          const status = receipt.status === 1 ? TxStatus.CONFIRMED : TxStatus.FAILED;
          const result: TransactionReceipt = {
            hash: txHash,
            status,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            effectiveGasPrice: receipt.gasPrice?.toString(),
            confirmations
          };

          // 如果失败，解析失败原因
          if (status === TxStatus.FAILED) {
            result.failureReason = await this.parseFailureReason(txHash, provider);
          }

          if (onStatusChange) onStatusChange(result);
          resolve(result);
        } catch (error: any) {
          console.error('轮询交易状态失败:', error);
        }
      };

      // 开始轮询
      const intervalId = setInterval(pollStatus, this.pollInterval);
      this.activeMonitors.set(txHash, intervalId);

      // 立即执行一次
      pollStatus();
    });
  }

  async pollStatus(txHash: string): Promise<TransactionReceipt | null> {
    const provider = this.walletSDK.getProvider();
    if (!provider) return null;

    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        return {
          hash: txHash,
          status: TxStatus.PENDING
        };
      }

      const status = receipt.status === 1 ? TxStatus.CONFIRMED : TxStatus.FAILED;
      const result: TransactionReceipt = {
        hash: txHash,
        status,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.gasPrice?.toString()
      };

      if (status === TxStatus.FAILED) {
        result.failureReason = await this.parseFailureReason(txHash, provider);
      }

      return result;
    } catch (error) {
      console.error('查询交易状态失败:', error);
      return null;
    }
  }

  private async parseFailureReason(
    txHash: string,
    provider: ethers.BrowserProvider
  ): Promise<string> {
    try {
      const tx = await provider.getTransaction(txHash);
      if (!tx) return '未知错误';

      // 尝试重放交易以获取 revert 消息
      try {
        await provider.call({
          to: tx.to,
          from: tx.from,
          data: tx.data,
          value: tx.value
        });
      } catch (error: any) {
        // 解析 revert 消息
        if (error.data) {
          return this.decodeRevertReason(error.data);
        }
        return error.message || '交易执行失败';
      }

      return '交易被回滚';
    } catch {
      return '无法解析失败原因';
    }
  }

  private decodeRevertReason(data: string): string {
    try {
      // Error(string) 的函数签名
      const errorSignature = '0x08c379a0';
      
      if (data.startsWith(errorSignature)) {
        // 解码 ABI 编码的字符串
        const reason = ethers.AbiCoder.defaultAbiCoder().decode(
          ['string'],
          '0x' + data.slice(10)
        )[0];
        return reason;
      }

      return `Revert: ${data}`;
    } catch {
      return '无法解码错误信息';
    }
  }

  stopMonitoring(txHash: string): void {
    const intervalId = this.activeMonitors.get(txHash);
    if (intervalId) {
      clearInterval(intervalId);
      this.activeMonitors.delete(txHash);
    }
  }

  stopAllMonitoring(): void {
    this.activeMonitors.forEach((intervalId) => clearInterval(intervalId));
    this.activeMonitors.clear();
  }

  setPollInterval(milliseconds: number): void {
    this.pollInterval = milliseconds;
  }

  setTimeout(milliseconds: number): void {
    this.timeout = milliseconds;
  }
}
