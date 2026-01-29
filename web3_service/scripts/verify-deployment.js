/**
 * 验证 OrderBook 合约部署
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  console.log("=".repeat(60));
  console.log("OrderBook 合约部署验证");
  console.log("=".repeat(60), "\n");

  // 1. 检查环境变量
  console.log("[1/5] 检查环境变量...");
  const requiredEnvVars = ["MUMBAI_RPC_URL", "PRIVATE_KEY", "ORDERBOOK_ADDRESS", "USDOL_ADDRESS"];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.log("❌ 缺少环境变量:", missingVars.join(", "));
    console.log("请检查 .env 文件");
    process.exit(1);
  }
  console.log("✅ 环境变量配置正确\n");

  // 2. 连接网络
  console.log("[2/5] 连接 Mumbai 测试网...");
  const provider = new ethers.JsonRpcProvider(process.env.MUMBAI_RPC_URL);
  
  try {
    const network = await provider.getNetwork();
    console.log("✅ 网络连接成功");
    console.log("   Chain ID:", network.chainId.toString());
    console.log("   Network:", network.name || "mumbai", "\n");
  } catch (error) {
    console.log("❌ 网络连接失败:", error.message);
    process.exit(1);
  }

  // 3. 检查账户
  console.log("[3/5] 检查部署账户...");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);
  
  console.log("✅ 账户信息:");
  console.log("   地址:", wallet.address);
  console.log("   余额:", ethers.formatEther(balance), "MATIC");
  
  if (balance === 0n) {
    console.log("⚠️  警告: 账户余额为 0，无法发送交易");
  }
  console.log();

  // 4. 验证合约部署
  console.log("[4/5] 验证合约部署...");
  
  const usdolCode = await provider.getCode(process.env.USDOL_ADDRESS);
  if (usdolCode === "0x") {
    console.log("❌ USDOL 合约未部署或地址错误");
    process.exit(1);
  }
  console.log("✅ USDOL 合约已部署:", process.env.USDOL_ADDRESS);

  const orderBookCode = await provider.getCode(process.env.ORDERBOOK_ADDRESS);
  if (orderBookCode === "0x") {
    console.log("❌ OrderBook 合约未部署或地址错误");
    process.exit(1);
  }
  console.log("✅ OrderBook 合约已部署:", process.env.ORDERBOOK_ADDRESS, "\n");

  // 5. 测试合约功能
  console.log("[5/5] 测试合约功能...");
  
  try {
    const OrderBookABI = require("../artifacts/contracts/OrderBook.sol/OrderBook.json").abi;
    const orderBook = new ethers.Contract(
      process.env.ORDERBOOK_ADDRESS,
      OrderBookABI,
      wallet
    );

    // 测试读取功能
    const orderCounter = await orderBook.orderCounter();
    console.log("✅ 合约可读取");
    console.log("   当前订单数:", orderCounter.toString());

    const usdolAddress = await orderBook.usdolToken();
    console.log("   USDOL 地址:", usdolAddress);
    
    if (usdolAddress.toLowerCase() !== process.env.USDOL_ADDRESS.toLowerCase()) {
      console.log("⚠️  警告: USDOL 地址不匹配");
    }
  } catch (error) {
    console.log("❌ 合约功能测试失败:", error.message);
    process.exit(1);
  }

  // 6. 检查部署文件
  console.log("\n[额外] 检查部署文件...");
  const deploymentFile = path.join(__dirname, "../deployments/mumbai.json");
  
  if (fs.existsSync(deploymentFile)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    console.log("✅ 部署文件存在");
    console.log("   部署时间:", deployment.timestamp);
    console.log("   部署者:", deployment.deployer);
  } else {
    console.log("⚠️  部署文件不存在");
  }

  // 总结
  console.log("\n" + "=".repeat(60));
  console.log("✅ 验证完成！合约部署正常");
  console.log("=".repeat(60));
  console.log("\n📝 合约地址:");
  console.log("   USDOL:     ", process.env.USDOL_ADDRESS);
  console.log("   OrderBook: ", process.env.ORDERBOOK_ADDRESS);
  console.log("\n🔗 区块浏览器:");
  console.log("   https://mumbai.polygonscan.com/address/" + process.env.ORDERBOOK_ADDRESS);
  console.log("\n🎯 下一步:");
  console.log("   1. 运行示例: node examples/orderbook-usage.js");
  console.log("   2. 集成到前端");
  console.log("   3. 开始测试\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ 验证失败:", error.message);
    process.exit(1);
  });
