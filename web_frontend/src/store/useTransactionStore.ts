import { create } from 'zustand'
import { TransactionManager } from '../services/transactionManager'
import { TransactionEvent } from '../services/eventService'
import { ethers } from 'ethers'

// OrderBook ABI - 只包含需要的事件
const orderbookABI = [
  'event OrderFilled(bytes32 indexed orderKey, address indexed buyer, address indexed seller, uint256 tokenId, uint256 price, uint256 timestamp)'
]

interface TransactionStore {
  transactions: TransactionEvent[]
  isLoading: boolean
  isSyncing: boolean
  error: string | null
  manager: TransactionManager | null
  
  initManager: (provider: ethers.Provider, orderbookAddress: string) => Promise<void>
  syncTransactions: (userAddress: string) => Promise<void>
  watchTransactions: (userAddress: string) => void
  stopWatching: () => void
  forceRefresh: (userAddress: string) => Promise<void>
  exportTransactions: (userAddress: string, format: 'json' | 'csv') => Promise<string>
  clearError: () => void
}

export const useTransactionStore = create<TransactionStore>((set, get) => ({
  transactions: [],
  isLoading: false,
  isSyncing: false,
  error: null,
  manager: null,
  
  initManager: async (provider: ethers.Provider, orderbookAddress: string) => {
    try {
      const manager = new TransactionManager(
        provider,
        orderbookAddress,
        orderbookABI
      )
      
      await manager.init()
      set({ manager })
    } catch (error: any) {
      set({ error: error.message || 'Failed to initialize manager' })
    }
  },
  
  syncTransactions: async (userAddress: string) => {
    const { manager } = get()
    if (!manager) {
      set({ error: 'Manager not initialized' })
      return
    }
    
    set({ isSyncing: true, error: null })
    
    try {
      // 先从缓存加载
      set({ isLoading: true })
      const cachedTxs = await manager.getTransactions(userAddress)
      set({ transactions: cachedTxs, isLoading: false })
      
      // 后台同步新数据
      const newTxs = await manager.syncTransactions(userAddress)
      
      if (newTxs.length > 0) {
        // 重新加载所有交易
        const allTxs = await manager.getTransactions(userAddress)
        set({ transactions: allTxs })
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to sync transactions' })
    } finally {
      set({ isSyncing: false })
    }
  },
  
  watchTransactions: (userAddress: string) => {
    const { manager } = get()
    if (!manager) return
    
    manager.watchNewTransactions(userAddress, (newTx) => {
      set((state) => ({
        transactions: [newTx, ...state.transactions]
      }))
    })
  },
  
  stopWatching: () => {
    const { manager } = get()
    if (manager) {
      manager.stopWatching()
    }
  },
  
  forceRefresh: async (userAddress: string) => {
    const { manager } = get()
    if (!manager) {
      set({ error: 'Manager not initialized' })
      return
    }
    
    set({ isSyncing: true, error: null })
    
    try {
      const txs = await manager.forceRefresh(userAddress)
      set({ transactions: txs })
    } catch (error: any) {
      set({ error: error.message || 'Failed to refresh' })
    } finally {
      set({ isSyncing: false })
    }
  },
  
  exportTransactions: async (userAddress: string, format: 'json' | 'csv') => {
    const { manager } = get()
    if (!manager) {
      throw new Error('Manager not initialized')
    }
    
    return await manager.exportTransactions(userAddress, format)
  },
  
  clearError: () => {
    set({ error: null })
  }
}))