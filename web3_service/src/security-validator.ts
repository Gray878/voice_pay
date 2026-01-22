/**
 * SecurityValidator - 安全校验器
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { ethers } from 'ethers';

export interface SecurityCheckResult {
  isValid: boolean;
  reason?: string;
  warnings?: string[];
}

export class SecurityValidator {
  private blacklist: Set<string> = new Set();
  private etherscanApiKey?: string;
  private transactionHistory: Map<string, number[]> = new Map();

  constructor(etherscanApiKey?: string) {
    this.etherscanApiKey = etherscanApiKey;
  }

  checkBlacklist(address: string): boolean {
    return this.blacklist.has(address.toLowerCase());
  }

  addToBlacklist(address: string): void {
    this.blacklist.add(address.toLowerCase());
  }

  async validateContract(address: string): Promise<SecurityCheckResult> {
    const warnings: string[] = [];

    if (this.checkBlacklist(address)) {
      return { isValid: false, reason: '该地址在黑名单中' };
    }

    if (!ethers.isAddress(address)) {
      return { isValid: false, reason: '无效的地址格式' };
    }

    if (this.etherscanApiKey) {
      const isVerified = await this.checkContractVerification(address);
      if (!isVerified) {
        warnings.push('合约源码未验证');
      }
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private async checkContractVerification(address: string): Promise<boolean> {
    if (!this.etherscanApiKey) return false;

    try {
      const url = `https://api.etherscan.io/api?module=contract&action=getabi&address=${address}&apikey=${this.etherscanApiKey}`;
      const response = await fetch(url);
      const data = await response.json() as any;
      return data.status === '1' && data.message === 'OK';
    } catch (error) {
      console.warn('查询合约验证状态失败:', error);
      return false;
    }
  }

  checkLargeTransaction(amount: string, userAddress: string): boolean {
    const amountNum = parseFloat(amount);
    const history = this.transactionHistory.get(userAddress.toLowerCase()) || [];
    
    if (history.length === 0) return false;

    const average = history.reduce((sum, val) => sum + val, 0) / history.length;
    return amountNum > average * 5;
  }

  recordTransaction(userAddress: string, amount: string): void {
    const amountNum = parseFloat(amount);
    const address = userAddress.toLowerCase();
    
    if (!this.transactionHistory.has(address)) {
      this.transactionHistory.set(address, []);
    }
    
    const history = this.transactionHistory.get(address)!;
    history.push(amountNum);
    
    if (history.length > 20) {
      history.shift();
    }
  }
}
