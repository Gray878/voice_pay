import { useState, useEffect } from 'react'
import { useTransactionStore } from '../store/useTransactionStore'
import { TransactionEvent } from '../services/eventService'

interface TransactionHistoryProps {
  userAddress: string | null
  isConnected: boolean
}

export default function TransactionHistory({ userAddress, isConnected }: TransactionHistoryProps) {
  const { 
    transactions, 
    isLoading,
    isSyncing,
    error,
    syncTransactions,
    watchTransactions,
    stopWatching,
    forceRefresh,
    exportTransactions,
    clearError
  } = useTransactionStore()
  
  const [isExpanded, setIsExpanded] = useState(false)
  
  useEffect(() => {
    if (isConnected && userAddress) {
      // 初始同步
      syncTransactions(userAddress)
      
      // 监听新交易
      watchTransactions(userAddress)
    }
    
    return () => {
      stopWatching()
    }
  }, [isConnected, userAddress])
  
  const handleRefresh = async () => {
    if (userAddress) {
      await syncTransactions(userAddress)
    }
  }
  
  const handleExport = async (format: 'json' | 'csv') => {
    if (!userAddress) return
    
    try {
      const data = await exportTransactions(userAddress, format)
      const blob = new Blob([data], { 
        type: format === 'json' ? 'application/json' : 'text/csv' 
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transactions-${Date.now()}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }
  
  if (!isConnected) {
    return null
  }
  
  const displayedTransactions = isExpanded 
    ? transactions 
    : transactions.slice(0, 3)
  
  return (
    <section className="mt-8">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">交易历史</h2>
          
          <div className="flex items-center space-x-3">
            {/* 导出按钮 */}
            <div className="relative group">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                📥
              </button>
              <div className="absolute right-0 mt-2 w-32 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  onClick={() => handleExport('json')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors"
                >
                  导出 JSON
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors"
                >
                  导出 CSV
                </button>
              </div>
            </div>
            
            {/* 刷新按钮 */}
            <button
              onClick={handleRefresh}
              disabled={isSyncing}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50"
            >
              <span className={isSyncing ? 'animate-spin' : ''}>🔄</span>
              <span className="text-sm">
                {isSyncing ? '同步中...' : '刷新'}
              </span>
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <span className="text-red-600 text-sm">{error}</span>
            <button
              onClick={clearError}
              className="text-red-600 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}
        
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            加载中...
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-3">🕐</div>
            <p className="text-gray-500">暂无交易记录</p>
            <p className="text-sm text-gray-400 mt-2">
              交易记录从区块链同步，完全去中心化
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {displayedTransactions.map((tx) => (
                <TransactionItem key={tx.txHash} transaction={tx} />
              ))}
            </div>
            
            {transactions.length > 3 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full mt-4 py-2 text-blue-600 hover:text-blue-700 transition-colors"
              >
                {isExpanded ? '收起' : `查看全部 (${transactions.length})`}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}

interface TransactionItemProps {
  transaction: TransactionEvent
}

function TransactionItem({ transaction }: TransactionItemProps) {
  const { txHash, status, tokenId, price, timestamp } = transaction
  
  const statusConfig = {
    success: {
      icon: '✅',
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      label: '成功',
    },
    failed: {
      icon: '❌',
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      label: '失败',
    },
  }
  
  const config = statusConfig[status]
  
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border hover:border-blue-300 transition-colors">
      <div className="flex items-center space-x-4 flex-1">
        <div className={`p-2 rounded-lg ${config.bg} border ${config.border}`}>
          <span className="text-2xl">{config.icon}</span>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-1">
            <span className="font-semibold">NFT #{tokenId}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${config.bg} ${config.color}`}>
              {config.label}
            </span>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>{price} USDOL</span>
            <span>•</span>
            <span>{formatDate(timestamp)}</span>
          </div>
        </div>
        
        <a
          href={`https://polygonscan.com/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
        >
          <span className="hidden md:inline">查看</span>
          <span>🔗</span>
        </a>
      </div>
    </div>
  )
}
