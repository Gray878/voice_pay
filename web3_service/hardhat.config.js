require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });

// 部署用私钥：支持 PRIVATE_KEY / WHIMLAND_PRIVATE_KEY / WEB3_SERVICE_PRIVATE_KEY
function getDeployerPrivateKey() {
  const key = process.env.PRIVATE_KEY || process.env.WHIMLAND_PRIVATE_KEY || process.env.WEB3_SERVICE_PRIVATE_KEY;
  if (!key || !key.trim()) return [];
  const trimmed = key.trim();
  return [trimmed.startsWith("0x") ? trimmed : "0x" + trimmed];
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    // Ethereum Sepolia 测试网 (最稳定)
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: getDeployerPrivateKey(),
      chainId: 11155111,
      timeout: 60000
    },
    
    // Base Sepolia 测试网 (推荐: Layer 2, 低成本)
    "base-sepolia": {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: getDeployerPrivateKey(),
      chainId: 84532,
      timeout: 60000
    },
    
    // Optimism Sepolia 测试网 (Layer 2, 交易成本极低)
    "optimism-sepolia": {
      url: process.env.OPTIMISM_SEPOLIA_RPC_URL || "https://sepolia.optimism.io",
      accounts: getDeployerPrivateKey(),
      chainId: 11155420,
      timeout: 60000
    },
    
    // Arbitrum Sepolia 测试网 (Layer 2, 高性能)
    "arbitrum-sepolia": {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: getDeployerPrivateKey(),
      chainId: 421614,
      timeout: 60000
    },
    
    // BSC 测试网 (交易速度快, Gas 费低)
    "bsc-testnet": {
      url: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: getDeployerPrivateKey(),
      chainId: 97,
      gasPrice: 10000000000, // 10 gwei
      timeout: 60000
    },
    
    // Polygon Amoy 测试网 (替代已废弃的 Mumbai)
    "polygon-amoy": {
      url: process.env.POLYGON_AMOY_RPC_URL || process.env.EVM_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: getDeployerPrivateKey(),
      chainId: 80002,
      timeout: 60000
    },
    
    // 本地测试网络
    localhost: {
      url: "http://127.0.0.1:8545",
      timeout: 60000
    },
    
    // Hardhat 网络
    hardhat: {
      chainId: 31337
    }
  },
  
  // 区块浏览器 API 密钥 (用于合约验证)
  etherscan: {
    apiKey: {
      // Ethereum
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      
      // Base
      "base-sepolia": process.env.BASESCAN_API_KEY || "",
      
      // Optimism
      "optimism-sepolia": process.env.OPTIMISM_API_KEY || "",
      
      // Arbitrum
      "arbitrum-sepolia": process.env.ARBISCAN_API_KEY || "",
      
      // BSC
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
      
      // Polygon
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || ""
    },
    customChains: [
      {
        network: "base-sepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      },
      {
        network: "optimism-sepolia",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api",
          browserURL: "https://sepolia-optimism.etherscan.io"
        }
      },
      {
        network: "arbitrum-sepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io"
        }
      },
      {
        network: "polygon-amoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com"
        }
      }
    ]
  },
  
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  
  mocha: {
    timeout: 60000
  }
};
