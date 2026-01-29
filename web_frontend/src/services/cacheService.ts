import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { TransactionEvent } from './eventService'

interface TransactionDB extends DBSchema {
  transactions: {
    key: string
    value: {
      txHash: string
      blockNumber: number
      timestamp: number
      eventName: string
      orderKey: string
      buyer?: string
      seller: string
      tokenId: string
      price: string
      status: 'success' | 'failed'
      userAddress: string
    }
    indexes: {
      'by-user': string
      'by-timestamp': number
      'by-block': number
    }
  }
  syncState: {
    key: string
    value: {
      userAddress: string
      lastSyncBlock: number
      lastSyncTime: number
    }
  }
}

export class CacheService {
  private db: IDBPDatabase<TransactionDB> | null = null
  private readonly DB_NAME = 'voice-to-pay-db'
  private readonly DB_VERSION = 1
  
  async init() {
    if (this.db) return
    
    this.db = await openDB<TransactionDB>(
      this.DB_NAME,
      this.DB_VERSION,
      {
        upgrade(db) {
          // 创建交易表
          if (!db.objectStoreNames.contains('transactions')) {
            const txStore = db.createObjectStore('transactions', {
              keyPath: 'txHash'
            })
            txStore.createIndex('by-user', 'userAddress')
            txStore.createIndex('by-timestamp', 'timestamp')
            txStore.createIndex('by-block', 'blockNumber')
          }
          
          // 创建同步状态表
          if (!db.objectStoreNames.contains('syncState')) {
            db.createObjectStore('syncState', {
              keyPath: 'userAddress'
            })
          }
        }
      }
    )
  }
  
  async saveTransaction(tx: TransactionEvent, userAddress: string) {
    if (!this.db) await this.init()
    
    await this.db!.put('transactions', {
      ...tx,
      userAddress
    })
  }
  
  async saveTransactions(txs: TransactionEvent[], userAddress: string) {
    if (!this.db) await this.init()
    
    const txn = this.db!.transaction('transactions', 'readwrite')
    const store = txn.objectStore('transactions')
    
    for (const tx of txs) {
      await store.put({
        ...tx,
        userAddress
      })
    }
    
    await txn.done
  }
  
  async getUserTransactions(userAddress: string): Promise<TransactionEvent[]> {
    if (!this.db) await this.init()
    
    const index = this.db!
      .transaction('transactions')
      .objectStore('transactions')
      .index('by-user')
    
    const txs = await index.getAll(userAddress)
    
    return txs.sort((a, b) => b.timestamp - a.timestamp)
  }
  
  async getSyncState(userAddress: string) {
    if (!this.db) await this.init()
    
    return await this.db!.get('syncState', userAddress)
  }
  
  async updateSyncState(userAddress: string, lastSyncBlock: number) {
    if (!this.db) await this.init()
    
    await this.db!.put('syncState', {
      userAddress,
      lastSyncBlock,
      lastSyncTime: Date.now()
    })
  }
  
  async clearUserData(userAddress: string) {
    if (!this.db) await this.init()
    
    const txn = this.db!.transaction('transactions', 'readwrite')
    const store = txn.objectStore('transactions')
    const index = store.index('by-user')
    
    const keys = await index.getAllKeys(userAddress)
    
    for (const key of keys) {
      await store.delete(key)
    }
    
    await this.db!.delete('syncState', userAddress)
    await txn.done
  }
}
