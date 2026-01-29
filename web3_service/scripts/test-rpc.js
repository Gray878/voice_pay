/**
 * 测试 Mumbai RPC 连接
 */

const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URLS = [
  "https://polygon-mumbai-bor.publicnode.com",
  "https://rpc.ankr.com/polygon_mumbai",
  "https://rpc-mumbai.maticvigil.com",
  "https://matic-mumbai.chainstacklabs.com",
  "https://rpc-mumbai.matic.today",
  "https://polygon-mumbai-bor-rpc.publicnode.com",
  "https://endpoints.omniatech.io/v1/matic/mumbai/public",
  "https://polygon-testnet.public.blastapi.io"
];

async function testRPC(url) {
  try {
    const provider = new ethers.JsonRpcProvider(url, undefined, {
      timeout: 10000
    });
    
    const startTime = Date.now();
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const responseTime = Date.now() - startTime;
    
    return {
      url,
      success: true,
      chainId: network.chainId.toString(),
      blockNumber: blockNumber.toString(),
      responseTime: `${responseTime}ms`
    };
  } catch (error) {
    return {
      url,
      success: false,
      error: error.message
    };
  }
}

async function main() {
  console.log("========================================");
  console.log("Testing Mumbai RPC Connections");
  console.log("========================================\n");

  // 测试当前配置的 RPC
  if (process.env.MUMBAI_RPC_URL) {
    console.log("Current RPC in .env:", process.env.MUMBAI_RPC_URL);
    const result = await testRPC(process.env.MUMBAI_RPC_URL);
    
    if (result.success) {
      console.log("✓ Connection successful");
      console.log("  Chain ID:", result.chainId);
      console.log("  Block Number:", result.blockNumber);
      console.log("  Response Time:", result.responseTime);
    } else {
      console.log("✗ Connection failed:", result.error);
    }
    console.log();
  }

  // 测试所有备用 RPC
  console.log("Testing alternative RPC endpoints...\n");
  
  const results = [];
  for (const url of RPC_URLS) {
    process.stdout.write(`Testing ${url}... `);
    const result = await testRPC(url);
    results.push(result);
    
    if (result.success) {
      console.log(`✓ ${result.responseTime}`);
    } else {
      console.log(`✗ Failed`);
    }
  }

  // 显示推荐
  console.log("\n========================================");
  console.log("Recommendations");
  console.log("========================================\n");

  const workingRPCs = results.filter(r => r.success);
  
  if (workingRPCs.length === 0) {
    console.log("✗ No working RPC endpoints found");
    console.log("\nPossible issues:");
    console.log("  1. Network connection problem");
    console.log("  2. Firewall blocking connections");
    console.log("  3. Mumbai testnet may be experiencing issues");
    console.log("\nSolutions:");
    console.log("  1. Check your internet connection");
    console.log("  2. Try using a VPN");
    console.log("  3. Wait and try again later");
  } else {
    // 按响应时间排序
    workingRPCs.sort((a, b) => {
      const timeA = parseInt(a.responseTime);
      const timeB = parseInt(b.responseTime);
      return timeA - timeB;
    });

    console.log("Working RPC endpoints (sorted by speed):\n");
    workingRPCs.forEach((rpc, index) => {
      console.log(`${index + 1}. ${rpc.url}`);
      console.log(`   Response Time: ${rpc.responseTime}`);
      console.log(`   Block Number: ${rpc.blockNumber}`);
      console.log();
    });

    console.log("Recommended: Update your .env file with the fastest RPC:");
    console.log(`MUMBAI_RPC_URL=${workingRPCs[0].url}`);
  }

  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nError:", error.message);
    process.exit(1);
  });
