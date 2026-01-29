import { ethers } from 'ethers'

export interface TransactionEvent {
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
}

export class EventService {
  private provider: ethers.Provider
  private orderbookContract: ethers.Contract
  
  constructor(
    provider: ethers.Provider,
    orderbookAddress: string,
    abi: any
  ) {
    this.provider = provider
    this.orderbookContract = new ethers.Contract(
      orderbookAddress,
      abi,
      provider
    )
  }
  
  /**
   * 查询用户的所有交易事件
   */
  async getUserTransactions(
    userAddress: string,
    fromBlock: number = 0
  ): Promise<TransactionEvent[]> {
    const events: TransactionEvent[] = []
    
    try {
      // 查询用户作为买家的交易
      const buyerFilter = this.orderbookContract.filters.OrderFilled(
        null,
        userAddress
      )
      const buyEvents = await this.orderbookContract.queryFilter(
        buyerFilter,
        fromBlock
      )
      
      // 查询用户作为卖家的交易
      const sellerFilter = this.orderbookContract.filters.OrderFilled(
        null,
        null,
        userAddress
      )
      const sellEvents = await this.orderbookContract.queryFilter(
        sellerFilter,
        fromBlock
      )
      
      // 合并并解析事件
      const allEvents = [...buyEvents, ...sellEvents]
      
      for (const event of allEvents) {
        const block = await event.getBlock()
        const receipt = await event.getTransactionReceipt()
        
        events.push({
          txHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp: block.timestamp * 1000,
          eventName: 'OrderFilled',
          orderKey: event.args.orderKey,
          buyer: event.args.buyer,
          seller: event.args.seller,
          tokenId: event.args.tokenId.toString(),
          price: ethers.formatUnits(event.args.price, 6), // USDOL 6 decimals
          status: receipt?.status === 1 ? 'success' : 'failed'
        })
      }
      
      // 按时间倒序排序
      return events.sort((a, b) => b.timestamp - a.timestamp)
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
      throw error
    }
  }
  
  /**
   * 监听新的交易事件
   */
  watchTransactions(
    userAddress: string,
    callback: (event: TransactionEvent) => void
  ) {
    const filter = this.orderbookContract.filters.OrderFilled(
      null,
      userAddress
    )
    
    this.orderbookContract.on(
      filter,
      async (orderKey, buyer, seller, tokenId, price, timestamp, event) => {
        const block = await event.getBlock()
        const receipt = await event.getTransactionReceipt()
        
        callback({
          txHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp: block.timestamp * 1000,
          eventName: 'OrderFilled',
          orderKey,
          buyer,
          seller,
          tokenId: tokenId.toString(),
          price: ethers.formatUnits(price, 6),
          status: receipt?.status === 1 ? 'success' : 'failed'
        })
      }
    )
  }
  
  /**
   * 停止监听
   */
  stopWatching() {
    this.orderbookContract.removeAllListeners()
  }
}
