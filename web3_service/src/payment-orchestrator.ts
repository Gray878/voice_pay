import { createMachine, interpret, StateMachine } from 'xstate';
import { WalletSelector, SelectionCriteria } from './wallet-selector';
import { ChainOptimizer } from './chain-optimizer';
import { TransactionModule, TransactionParams } from './transaction-module';
import { TransactionMonitor, TxStatus } from './transaction-monitor';

export enum PaymentState {
  IDLE = 'IDLE',
  WALLET_SELECTION = 'WALLET_SELECTION',
  CHAIN_OPTIMIZATION = 'CHAIN_OPTIMIZATION',
  GENERATING_SUMMARY = 'GENERATING_SUMMARY',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
  EXECUTING = 'EXECUTING',
  MONITORING = 'MONITORING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface PaymentContext {
  productId: string;
  productName: string;
  amount: string;
  recipientAddress: string;
  selectedWallet?: any;
  selectedChain?: number;
  estimatedGas?: string;
  txHash?: string;
  error?: string;
}

export interface PaymentSummary {
  productName: string;
  amount: string;
  currency: string;
  recipientAddress: string;
  fromWallet: string;
  chainName: string;
  estimatedGas: string;
  totalCost: string;
}

export class PaymentOrchestrator {
  private walletSelector: WalletSelector;
  private chainOptimizer: ChainOptimizer;
  private transactionModule: TransactionModule;
  private transactionMonitor: TransactionMonitor;
  private currentContext?: PaymentContext;
  private onStateChange?: (state: PaymentState, context: PaymentContext) => void;

  constructor(
    walletSelector: WalletSelector,
    chainOptimizer: ChainOptimizer,
    transactionModule: TransactionModule,
    transactionMonitor: TransactionMonitor
  ) {
    this.walletSelector = walletSelector;
    this.chainOptimizer = chainOptimizer;
    this.transactionModule = transactionModule;
    this.transactionMonitor = transactionMonitor;
  }

  async startPayment(context: PaymentContext): Promise<void> {
    this.currentContext = context;
    this.emitStateChange(PaymentState.WALLET_SELECTION, context);

    try {
      // 1. 选择钱包
      const criteria: SelectionCriteria = {
        targetChainId: 80001,
        requiredAmount: context.amount
      };
      const wallet = await this.walletSelector.selectBestWallet(criteria);
      
      if (!wallet) {
        throw new Error('未找到合适的钱包');
      }
      
      context.selectedWallet = wallet;
      this.emitStateChange(PaymentState.CHAIN_OPTIMIZATION, context);

      // 2. 链路优化
      const optimization = await this.chainOptimizer.optimizeTransaction(
        [80001],
        context.amount
      );
      context.selectedChain = optimization.recommendedChain;
      context.estimatedGas = optimization.estimatedGas;
      
      this.emitStateChange(PaymentState.GENERATING_SUMMARY, context);

      // 3. 生成摘要并等待确认
      const summary = this.generateSummary(context);
      this.emitStateChange(PaymentState.AWAITING_CONFIRMATION, context);

      // 等待用户确认（通过外部调用 confirmPayment）
    } catch (error: any) {
      context.error = error.message;
      this.emitStateChange(PaymentState.FAILED, context);
    }
  }

  generateSummary(context: PaymentContext): PaymentSummary {
    const chainConfig = this.chainOptimizer.getChainConfig(context.selectedChain || 80001);
    const totalCost = (parseFloat(context.amount) + parseFloat(context.estimatedGas || '0')).toFixed(6);

    return {
      productName: context.productName,
      amount: context.amount,
      currency: chainConfig?.nativeCurrency || 'MATIC',
      recipientAddress: context.recipientAddress,
      fromWallet: context.selectedWallet?.address || '',
      chainName: chainConfig?.name || '',
      estimatedGas: context.estimatedGas || '0',
      totalCost
    };
  }

  async confirmPayment(): Promise<void> {
    if (!this.currentContext) {
      throw new Error('没有待确认的支付');
    }

    const context = this.currentContext;
    this.emitStateChange(PaymentState.EXECUTING, context);

    try {
      // 执行交易
      const txParams: TransactionParams = {
        to: context.recipientAddress,
        value: context.amount
      };

      const result = await this.transactionModule.sendTransaction(txParams);
      context.txHash = result.hash;

      this.emitStateChange(PaymentState.MONITORING, context);

      // 监听交易状态
      await this.transactionMonitor.waitForConfirmation(
        result.hash,
        (receipt) => {
          if (receipt.status === TxStatus.CONFIRMED) {
            this.emitStateChange(PaymentState.COMPLETED, context);
          } else if (receipt.status === TxStatus.FAILED) {
            context.error = receipt.failureReason || '交易失败';
            this.emitStateChange(PaymentState.FAILED, context);
          }
        }
      );
    } catch (error: any) {
      context.error = error.message;
      this.emitStateChange(PaymentState.FAILED, context);
    }
  }

  cancelPayment(): void {
    if (this.currentContext) {
      this.emitStateChange(PaymentState.CANCELLED, this.currentContext);
      this.currentContext = undefined;
    }
  }

  onStateChangeCallback(callback: (state: PaymentState, context: PaymentContext) => void): void {
    this.onStateChange = callback;
  }

  private emitStateChange(state: PaymentState, context: PaymentContext): void {
    if (this.onStateChange) {
      this.onStateChange(state, context);
    }
  }

  getCurrentContext(): PaymentContext | undefined {
    return this.currentContext;
  }
}
