const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// 网络配置映射
const NETWORK_INFO = {
  'sepolia': { name: 'Ethereum Sepolia', chainId: 11155111, explorer: 'https://sepolia.etherscan.io' },
  'base-sepolia': { name: 'Base Sepolia', chainId: 84532, explorer: 'https://sepolia.basescan.org' },
  'optimism-sepolia': { name: 'Optimism Sepolia', chainId: 11155420, explorer: 'https://sepolia-optimism.etherscan.io' },
  'arbitrum-sepolia': { name: 'Arbitrum Sepolia', chainId: 421614, explorer: 'https://sepolia.arbiscan.io' },
  'bsc-testnet': { name: 'BSC Testnet', chainId: 97, explorer: 'https://testnet.bscscan.com' },
  'polygon-amoy': { name: 'Polygon Amoy', chainId: 80002, explorer: 'https://amoy.polygonscan.com' }
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const networkInfo = NETWORK_INFO[network] || { name: network, chainId: 'unknown', explorer: '' };
  
  console.log("========================================");
  console.log("🚀 部署智能合约");
  console.log("========================================");
  console.log("📍 网络:", networkInfo.name);
  console.log("🔗 Chain ID:", networkInfo.chainId);
  console.log("👤 部署账户:", deployer.address);
  console.log("💰 账户余额:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("========================================\n");

  console.log("1️⃣ 部署 MockUSDOL...");
  const MockUSDOL = await hre.ethers.getContractFactory("MockUSDOL");
  const usdol = await MockUSDOL.deploy();
  await usdol.waitForDeployment();
  const usdolAddress = await usdol.getAddress();
  console.log("✅ MockUSDOL 部署成功:", usdolAddress);
  console.log(`   查看: ${networkInfo.explorer}/address/${usdolAddress}\n`);

  console.log("2️⃣ 部署 OrderBook...");
  const OrderBook = await hre.ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy(usdolAddress);
  await orderBook.waitForDeployment();
  const orderBookAddress = await orderBook.getAddress();
  console.log("✅ OrderBook 部署成功:", orderBookAddress);
  console.log(`   查看: ${networkInfo.explorer}/address/${orderBookAddress}\n`);

  const deploymentInfo = {
    network: networkInfo.name,
    networkKey: network,
    chainId: networkInfo.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    explorer: networkInfo.explorer,
    contracts: {
      MockUSDOL: { 
        address: usdolAddress,
        url: `${networkInfo.explorer}/address/${usdolAddress}`
      },
      OrderBook: { 
        address: orderBookAddress,
        url: `${networkInfo.explorer}/address/${orderBookAddress}`
      }
    }
  };

  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentDir, `${network}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  const envPath = path.join(__dirname, "../.env");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  
  const updateEnv = (content, key, value) => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    return regex.test(content) 
      ? content.replace(regex, `${key}=${value}`)
      : content + `\n${key}=${value}`;
  };

  envContent = updateEnv(envContent, "ORDERBOOK_ADDRESS", orderBookAddress);
  envContent = updateEnv(envContent, "USDOL_ADDRESS", usdolAddress);
  fs.writeFileSync(envPath, envContent.trim() + "\n");

  console.log("========================================");
  console.log("✅ 部署完成!");
  console.log("========================================");
  console.log("📍 网络:", networkInfo.name);
  console.log("💵 USDOL:", usdolAddress);
  console.log("📖 OrderBook:", orderBookAddress);
  console.log("📁 部署信息已保存到:", `deployments/${network}.json`);
  console.log("🔧 .env 文件已更新");
  console.log("========================================\n");
  
  console.log("💡 下一步:");
  console.log("   1. 验证合约: npx hardhat verify --network", network, orderBookAddress, usdolAddress);
  console.log("   2. 测试合约: node scripts/verify-deployment.js");
  console.log("   3. 启动服务: npm start\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
