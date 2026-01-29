/**
 * OrderBook 集成示例 (TypeScript)
 * 展示如何在 Web3 Service 中集成 OrderBook 合约
 */

import { ethers } from 'ethers';
import OrderBookABI from '../artifacts/contracts/OrderBook.sol/OrderBook.json';
import MockUSDOLABI from '../artifacts/contracts/MockUSDOL.sol/MockUSDOL.json';

interface OrderData {
  orderId: bigint;
  trader: string;
  orderType: number;
  tokenAddress: string;
  amount: bigint;
  price: bigint;
  timestamp: bigint;
  status: number;
}

export class OrderBookService {
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private orderBook: ethers.Contract;
  private usdol: ethers.Contract;

  constructor(
    rpcUrl: string,
    privateKey: string,
    orderBookAddress: string,
    usdolAddress: string
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    this.orderBook = new ethers.Contract(
      orderBookAddress,
      OrderBookABI.abi,
      this.wallet
    );
    
    this.usdol = new ethers.Contract(
      usdolAddress,
      MockUSDOLABI.abi,
      this.wallet
    );
  }

  /**
   * 创建买单
   */
  async createBuyOrder(
    tokenAddress: string,
    amount: string,
    price: string
  ): Promise<{ orderId: bigint; txHash: string }> {
    try {
      const amountWei = ethers.parseEther(amount);
      const priceWei = ethers.parseEther(price);
      const totalCost = amountWei * priceWei / ethers.parseEther("1");

      // 检查 USDOL 余额
      const balance = await this.usdol.balanceOf(this.wallet.address);
      if (balance < totalCost) {
        throw new Error(`USDOL 余额不足。需要: ${ethers.formatEther(totalCost)}, 当前: ${ethers.formatEther(balance)}`);
      }

      // 授权 USDOL
      const allowance = await this.usdol.allowance(
        this.wallet.address,
        await this.orderBook.getAddress()
      );

      if (allowance < totalCost) {
        console.log('授权 USDOL...');
        const approveTx = await this.usdol.approve(
          await this.orderBook.getAddress(),
          totalCost
        );
        await approveTx.wait();
      }

      // 创建买单
      const tx = await this.orderBook.createBuyOrder(
        tokenAddress,
        amountWei,
        priceWei
      );
      const receipt = await tx.wait();

      // 从事件中获取订单 ID
      const event = receipt.logs.find((log: any) => {
        try {
          return this.orderBook.interface.parseLog(log)?.name === 'OrderCreated';
        } catch {
          return false;
        }
      });

      const orderId = event 
        ? this.orderBook.interface.parseLog(event)?.args.orderId
        : 0n;

      return {
        orderId,
        txHash: receipt.hash
      };
    } catch (error: any) {
      throw new Error(`创建买单失败: ${error.message}`);
    }
  }

  /**
   * 创建卖单
   */
  async createSellOrder(
    tokenAddress: string,
    amount: string,
    price: string
  ): Promise<{ orderId: bigint; txHash: string }> {
    try {
      const amountWei = ethers.parseEther(amount);
      const priceWei = ethers.parseEther(price);

      // 检查代币余额和授权
      const token = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'],
        this.wallet
      );

      const balance = await token.balanceOf(this.wallet.address);
      if (balance < amountWei) {
        throw new Error(`代币余额不足`);
      }

      // 授权代币
      const approveTx = await token.approve(
        await this.orderBook.getAddress(),
        amountWei
      );
      await approveTx.wait();

      // 创建卖单
      const tx = await this.orderBook.createSellOrder(
        tokenAddress,
        amountWei,
        priceWei
      );
      const receipt = await tx.wait();

      const event = receipt.logs.find((log: any) => {
        try {
          return this.orderBook.interface.parseLog(log)?.name === 'OrderCreated';
        } catch {
          return false;
        }
      });

      const orderId = event 
        ? this.orderBook.interface.parseLog(event)?.args.orderId
        : 0n;

      return {
        orderId,
        txHash: receipt.hash
      };
    } catch (error: any) {
      throw new Error(`创建卖单失败: ${error.message}`);
    }
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId: bigint): Promise<string> {
    try {
      const tx = await this.orderBook.cancelOrder(orderId);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error: any) {
      throw new Error(`取消订单失败: ${error.message}`);
    }
  }

  /**
   * 查询订单详情
   */
  async getOrder(orderId: bigint): Promise<OrderData> {
    try {
      const order = await this.orderBook.getOrder(orderId);
      return {
        orderId: order.orderId,
        trader: order.trader,
        orderType: Number(order.orderType),
        tokenAddress: order.tokenAddress,
        amount: order.amount,
        price: order.price,
        timestamp: order.timestamp,
        status: Number(order.status)
      };
    } catch (error: any) {
      throw new Error(`查询订单失败: ${error.message}`);
    }
  }

  /**
   * 查询用户所有订单
   */
  async getUserOrders(userAddress: string): Promise<OrderData[]> {
    try {
      const orderIds = await this.orderBook.getUserOrders(userAddress);
      if (orderIds.length === 0) return [];

      const orders = await this.orderBook.getOrdersBatch(orderIds);
      return orders.map((order: any) => ({
        orderId: order.orderId,
        trader: order.trader,
        orderType: Number(order.orderType),
        tokenAddress: order.tokenAddress,
        amount: order.amount,
        price: order.price,
        timestamp: order.timestamp
import { ethers } from 'ethers';

export class OrderBookService {
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private orderBook: ethers.Contract;
  private usdol: ethers.Contract;

  constructor(rpcUrl: string, privateKey: string, orderBookAddress: string, usdolAddress: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.orderBook = new ethers.Contract(orderBookAddress, [], this.wallet);
    this.usdol = new ethers.Contract(usdolAddress, [], this.wallet);
  }

  async createBuyOrder(tokenAddress: string, amount: string, price: string) {
    const amountWei = ethers.parseEther(amount);
    const priceWei = ethers.parseEther(price);
    const totalCost = amountWei * priceWei / ethers.parseEther("1");
    
    await this.usdol.approve(await this.orderBook.getAddress(), totalCost);
    const tx = await this.orderBook.createBuyOrder(tokenAddress, amountWei, priceWei);
    return await tx.wait();
  }

  async getOrder(orderId: bigint) {
    return await this.orderBook.getOrder(orderId);
  }

  async getUserOrders(userAddress: string) {
    const orderIds = await this.orde