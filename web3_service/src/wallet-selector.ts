import { ethers } from 'ethers';
import { WalletSDK } from './wallet-sdk';

export interface WalletInfo {
  name: string;
  address: string;
  chainId: number;
  balance: string;
  provider: any;
}

export interface SelectionCriteria {
  targetChainId: number;
  requiredAmount: string;
  userPreference?: string;
  estimatedGasCost?: string;
}

export class WalletSelector {
  private walletSDK: WalletSDK;
  private detectedWallets: WalletInfo[] = [];

  constructor(walletSDK: WalletSDK) {
    this.walletSDK = walletSDK;
  }

  async detectWallets(): Promise<WalletInfo[]> {
    const wallets: WalletInfo[] = [];
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
        if (accounts.length > 0) {
          const network = await provider.getNetwork();
          const balance = await provider.getBalance(accounts[0]);
          wallets.push({
            name: 'MetaMask',
            address: accounts[0],
            chainId: Number(network.chainId),
            balance: ethers.formatEther(balance),
            provider: window.ethereum
          });
        }
      } catch (error) {
        console.warn('检测钱包失败:', error);
      }
    }
    this.detectedWallets = wallets;
    return wallets;
  }

  async selectBestWallet(criteria: SelectionCriteria): Promise<WalletInfo | null> {
    if (this.detectedWallets.length === 0) await this.detectWallets();
    if (this.detectedWallets.length === 0) return null;

    const scores = this.detectedWallets.map(wallet => ({
      wallet,
      score: this.calculateScore(wallet, criteria)
    }));

    scores.sort((a, b) => b.score - a.score);
    return scores[0].score > 0 ? scores[0].wallet : null;
  }

  private calculateScore(wallet: WalletInfo, criteria: SelectionCriteria): number {
    let score = 0;
    if (wallet.chainId === criteria.targetChainId) score += 40;
    
    const required = parseFloat(criteria.requiredAmount) + parseFloat(criteria.estimatedGasCost || '0');
    const balance = parseFloat(wallet.balance);
    if (balance >= required) {
      score += Math.min(30, ((balance - required) / required) * 30);
    } else {
      score -= 20;
    }
    
    if (criteria.userPreference && wallet.address.toLowerCase() === criteria.userPreference.toLowerCase()) {
      score += 20;
    }
    
    if (wallet.chainId === criteria.targetChainId && criteria.estimatedGasCost) {
      score += Math.max(0, 10 - parseFloat(criteria.estimatedGasCost) * 100);
    }
    
    return score;
  }

  async switchNetwork(targetChainId: number): Promise<boolean> {
    try {
      await this.walletSDK.switchNetwork(targetChainId);
      return true;
    } catch {
      return false;
    }
  }
}
