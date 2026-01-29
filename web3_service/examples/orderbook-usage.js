/**
 * OrderBook 合约使用示例
 * 演示如何与 OrderBook 合约交互
 */

const { ethers } = require("ethers");
require("dotenv").config();

// 导入合约 ABI
const OrderBookABI = require("../artifacts/contracts/OrderBook.sol/OrderBook.json").abi;
const MockUSDOLABI = require("../artifacts/contracts/MockUSDOL.sol/MockUSDOL.json").abi;

async function main() {
  // 1. 连接到 Mumbai 测试网
  const provider = new ethers.JsonRpcProvider(process.env.MUMBAI_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log("连接账户:", wallet.address);
  console.log("余额:", ethers.formatEther(await provider.getBalance(wallet.address)), "MATIC\n");

  // 2. 连接合约
  const orderBook = new ethers.Contract(
    process.env.ORDERBOOK_ADDRESS,
    OrderBookABI,
    wallet
  );

  const usdol = new ethers.Contract(
    process.env.USDOL_ADDRESS,
    MockUSDOLABI,
    wallet
  );

  console.log("OrderBook 地址:", await orderBook.getAddress());
  console.log("USDOL 地址:", await usdol.getAddress(), "\n");

  // 3. 检查 USDOL 余额
  const usdolBalance = await usdol.balanceOf(wallet.address);
  console.log("USDOL 余额:", ethers.formatEther(usdolBalance), "USDOL");

  // 如果余额为 0，铸造一些测试币
  if (usdolBalance === 0n) {
    console.log("铸造 10000 USDOL...");
    const mintTx = await usdol.mint(wallet.address, ethers.parseEther("10000"));
    await mintTx.wait();
    console.log("铸造成功!\n");
  }

  // 4. 创建买单示例
  console.log("=== 创建买单 ===");
  
  const tokenAddress = "0x0000000000000000000000000000000000000001"; // 示例代币地址
  const buyAmount = ethers.parseEther("10");
  const buyPrice = ethers.parseEther("100");
  const totalCost = buyAmount * buyPrice / ethers.parseEther("1");

  console.log("购买数量:", ethers.formatEther(buyAmount));
  console.log("单价:", ethers.formatEther(buyPrice), "USDOL");
  console.log("总成本:", ethers.formatEther(totalCost), "USDOL");

  // 授权 USDOL
  console.log("授权 USDOL...");
  const approveTx = await usdol.approve(await orderBook.getAddress(), totalCost);
  await approveTx.wait();
  console.log("授权成功!");

  // 创建买单
  console.log("创建买单...");
  const createBuyTx = await orderBook.createBuyOrder(tokenAddress, buyAmount, buyPrice);
  const receipt = await createBuyTx.wait();
  console.log("买单创建成功! 交易哈希:", receipt.hash);

  // 从事件中获取订单 ID
  const event = receipt.logs.find(log => {
    try {
      return orderBook.interface.parseLog(log).name === "OrderCreated";
    } catch {
      return false;
    }
  });

  if (event) {
    const parsedEvent = orderBook.interface.parseLog(event);
    const orderId = parsedEvent.args.orderId;
    console.log("订单 ID:", orderId.toString(), "\n");

    // 5. 查询订单详情
    console.log("=== 查询订单详情 ===");
    const order = await orderBook.getOrder(orderId);
    console.log("订单信息:");
    console.log("  订单 ID:", order.orderId.toString());
    console.log("  交易者:", order.trader);
    console.log("  类型:", order.orderType === 0n ? "买单" : "卖单");
    console.log("  代币地址:", order.tokenAddress);
    console.log("  数量:", ethers.formatEther(order.amount));
    console.log("  单价:", ethers.formatEther(order.price), "USDOL");
    console.log("  状态:", ["活跃", "已成交", "已取消"][Number(order.status)]);
    console.log("  创建时间:", new Date(Number(order.timestamp) * 1000).toLocaleString(), "\n");

    // 6. 查询用户所有订单
    console.log("=== 查询用户订单 ===");
    const userOrderIds = await orderBook.getUserOrders(wallet.address);
    console.log("用户订单数量:", userOrderIds.length);
    console.log("订单 IDs:", userOrderIds.map(id => id.toString()).join(", "), "\n");

    // 7. 取消订单示例
    console.log("=== 取消订单 ===");
    console.log("取消订单 ID:", orderId.toString());
    const cancelTx = await orderBook.cancelOrder(orderId);
    await cancelTx.wait();
    console.log("订单取消成功!");

    // 验证订单状态
    const cancelledOrder = await orderBook.getOrder(orderId);
    console.log("订单状态:", ["活跃", "已成交", "已取消"][Number(cancelledOrder.status)]);
  }

  console.log("\n✅ 示例执行完成!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
