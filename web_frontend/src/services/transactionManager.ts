import { EventService, TransactionEvent } from './eventService'
import { CacheService } from './cacheService'
import { ethers } from 'ethers'

export class TransactionManager {
  private eventService: EventService
  private cacheService: CacheService
  private isSyncing: boolean = false
  private watchUnsubscribe: (() => void) | null = null
  
  constructor(
    provider: ethers.Provider,
    orderbookAddress: string,
    orderbookABI: any
  ) {
    this.eventService = new EventService(
      provider,
      orderbookAddress,
      orderbookABI
    )
    this.cacheService = new CacheService()
  }
  
  async init() {
    await this.cacheService.init()
  }
  
  /**
   * 同步用户交易记录
   */
  async syncTransactions(userAddress: string): Promise<TransactionEvent[]> {
    if (this.isSyncing) {
      console.log('Already syncing...')
      return []
    }
    
    this.isSyncing = true
    
    try {
      // 获取上次同步的区块高度
      const syncState = await this.cacheService.getSyncState(userAddress)
      const fromBlock = syncState?.lastSyncBlock || 0
      
      console.log(`Syncing from block ${fromBlock}...`)
      
      // 从链上查询新的交易事件
      const newTransactions = await this.eventService.getUserTransactions(
        userAddress,
        fromBlock
      )
      
      if (newTransactions.length > 0) {
        // 保存到本地缓存
        await this.cacheService.saveTransactions(
          newTransactions,
          userAddress
        )
        
        // 更新同步状态
        const latestBlock = Math.max(
          ...newTransactions.map(tx => tx.blockNumber)
        )
        await this.cacheService.updateSyncState(userAddress, latestBlock)
        
        console.log(`Synced ${newTransactions.length} new transactions`)
      }
      
      return newTransactions
    } catch (error) {
      console.error('Sync failed:', error)
      throw error
    } finally {
      this.isSyncing = false
    }
  }
  
  /**
   * 获取用户交易记录（从缓存）
   */
  async getTransactions(userAddress: string): Promise<TransactionEvent[]> {
    return await this.cacheService.getUserTransactions(userAddress)
  }
  
  /**
   * 强制刷新（清除缓存并重新同步）
   */
  async forceRefresh(userAddress: string): Promise<TransactionEvent[]> {
    await this.cacheService.clearUserData(userAddress)
    return await this.syncTransactions(userAddress)
  }
  
  /**
   * 监听新交易
   */
  watchNewTransactions(
    userAddress: string,
    callback: (tx: TransactionEvent) => void
  ) {
    this.eventService.watchTransactions(userAddress, async (tx) => {
      // 保存到缓存
      await this.cacheService.saveTransaction(tx, userAddress)
      
      // 触发回调
      callback(tx)
    })
    
    this.watchUnsubscribe = () => {
      this.eventService.stopWatching()
    }
  }
  
  /**
   * 停止监听
   */
  stopWatching() {
    if (this.watchUnsubscribe) {
      this.watchUnsubscribe()
      this.watchUnsubscribe = null
    }
  }
  
  /**
   * 导出交易记录
   */
  async exportTransactions(
    userAddress: string,
    format: 'json' | 'csv'
  ): Promise<string> {
    const transactions = await this.getTransactions(userAddress)
    
    if (format === 'json') {
      return JSON.stringify(transactions, null, 2)
    } else {
      return this.convertToCSV(transactions)
    }
  }
  
  private convertToCSV(transactions: TransactionEvent[]): string {
    if (transactions.length === 0) return ''
    
    const headers = [
      'Transaction Hash',
      'Block Number',
      'Timestamp',
      'Event',
      'Token ID',
      'Price',
      'Buyer',
      'Seller',
      'Status'
    ]
    
    const rows = transactions.map(tx => [
      tx.txHash,
      tx.blockNumber.toString(),
      new Date(tx.timestamp).toISOString(),
      tx.eventName,
      tx.tokenId,
      tx.price,
      tx.buyer || '',
      tx.seller,
      tx.status
    ])
    
    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')
  }
}
