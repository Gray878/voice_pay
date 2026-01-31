/**
 * Web3 服务配置管理
 * 从环境变量加载配置
 */

import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量（override: true 确保 .env 覆盖 shell 里已存在的同名变量，INDEXER_BATCH_SIZE 等生效）
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

/**
 * 应用配置接口
 */
export interface AppConfig {
  // 环境配置
  nodeEnv: string;
  environment: 'testnet' | 'mainnet';
  
  // 服务配置
  web3ServiceHost: string;
  web3ServicePort: number;
  
  // 区块链配置
  polygonMumbaiRpcUrl: string;
  polygonMumbaiChainId: number;
  web3ServicePrivateKey?: string;
  
  // Alchemy 配置
  alchemyApiKey?: string;
  alchemyPolygonMumbaiRpc?: string;
  
  // Etherscan API
  etherscanApiKey?: string;
  polygonscanApiKey?: string;
  
  // 数据库配置
  postgresHost: string;
  postgresPort: number;
  postgresDb: string;
  postgresUser: string;
  postgresPassword: string;
  
  // Redis 配置
  redisHost: string;
  redisPort: number;
  redisDb: number;
  redisPassword?: string;
  
  // 会话配置
  sessionTtl: number;
  
  // 安全配置
  apiSecretKey: string;
  corsOrigin: string;
  
  // 日志配置
  logLevel: string;
  
  // Gas 配置
  gasLimitMultiplier: number;
}

/**
 * 加载配置
 */
export const config: AppConfig = {
  // 环境配置
  nodeEnv: process.env.NODE_ENV || 'development',
  environment: (process.env.ENVIRONMENT as 'testnet' | 'mainnet') || 'testnet',
  
  // 服务配置
  web3ServiceHost: process.env.WEB3_SERVICE_HOST || 'localhost',
  web3ServicePort: parseInt(process.env.WEB3_SERVICE_PORT || '3000', 10),
  
  // 区块链配置
  polygonMumbaiRpcUrl: process.env.POLYGON_MUMBAI_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
  polygonMumbaiChainId: parseInt(process.env.POLYGON_MUMBAI_CHAIN_ID || '80001', 10),
  web3ServicePrivateKey: process.env.WEB3_SERVICE_PRIVATE_KEY,
  
  // Alchemy 配置
  alchemyApiKey: process.env.ALCHEMY_API_KEY,
  alchemyPolygonMumbaiRpc: process.env.ALCHEMY_POLYGON_MUMBAI_RPC,
  
  // Etherscan API
  etherscanApiKey: process.env.ETHERSCAN_API_KEY,
  polygonscanApiKey: process.env.POLYGONSCAN_API_KEY,
  
  // 数据库配置
  postgresHost: process.env.POSTGRES_HOST || 'localhost',
  postgresPort: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  postgresDb: process.env.POSTGRES_DB || 'voice_to_pay',
  postgresUser: process.env.POSTGRES_USER || 'postgres',
  postgresPassword: process.env.POSTGRES_PASSWORD || '',
  
  // Redis 配置
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisDb: parseInt(process.env.REDIS_DB || '0', 10),
  redisPassword: process.env.REDIS_PASSWORD,
  
  // 会话配置
  sessionTtl: parseInt(process.env.SESSION_TTL || '600', 10),
  
  // 安全配置
  apiSecretKey: process.env.API_SECRET_KEY || 'dev-secret-key',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  // 日志配置
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Gas 配置
  gasLimitMultiplier: parseFloat(process.env.GAS_LIMIT_MULTIPLIER || '1.2'),
};

/**
 * 获取 PostgreSQL 连接 URL
 */
export function getPostgresUrl(): string {
  return `postgresql://${config.postgresUser}:${config.postgresPassword}@${config.postgresHost}:${config.postgresPort}/${config.postgresDb}`;
}

/**
 * 获取 Redis 连接 URL
 */
export function getRedisUrl(): string {
  if (config.redisPassword) {
    return `redis://:${config.redisPassword}@${config.redisHost}:${config.redisPort}/${config.redisDb}`;
  }
  return `redis://${config.redisHost}:${config.redisPort}/${config.redisDb}`;
}

/**
 * 验证必需的环境变量
 */
export function validateConfig(): void {
  const requiredVars = [
    'POSTGRES_PASSWORD',
    'API_SECRET_KEY',
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(
      `缺少必需的环境变量: ${missing.join(', ')}\n` +
      '请检查 .env 文件是否正确配置'
    );
  }
}

// 在生产环境验证配置
if (config.nodeEnv === 'production') {
  validateConfig();
}
