/**
 * Web3 Service 主入口
 * Express 服务器 + Web3 模块集成
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { ethers } from 'ethers';
import { config } from './config';
import { walletSDK } from './wallet-sdk';
import { TransactionModule } from './transaction-module';
import { TransactionMonitor, TxStatus as MonitorTxStatus } from './transaction-monitor';
import { SecurityValidator } from './security-validator';
import { WalletSelector } from './wallet-selector';
import { ChainOptimizer } from './chain-optimizer';
import { PaymentOrchestrator } from './payment-orchestrator';
import { TransactionRecordManager, TxStatus, ExportFormat } from './transaction-record';
import { ErrorHandler, errorMiddleware, AppError } from './error-handler';
import { AssetActivator } from './asset-activator';
import { createLogger, Logger } from './logger';

const app = express();
const logger = createLogger('Main');

// 中间件
app.use(cors());
app.use(express.json());

// 请求 ID 中间件
app.use((req: any, res: Response, next: NextFunction) => {
  req.id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.logger = logger.child({ requestId: req.id });
  
  req.logger.info(`Request started: ${req.method} ${req.path}`);
  
  // 记录响应时间
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    req.logger.info(`Request completed: ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// 初始化数据库连接
const pgPool = new Pool({
  host: config.postgresHost,
  port: config.postgresPort,
  database: config.postgresDb,
  user: config.postgresUser,
  password: config.postgresPassword
});

const redisClient = createClient({
  url: `redis://${config.redisHost}:${config.redisPort}`
});

redisClient.connect().catch(console.error);

// 初始化服务
const securityValidator = new SecurityValidator();
const transactionModule = new TransactionModule(walletSDK, securityValidator);
const transactionMonitor = new TransactionMonitor(walletSDK);
const walletSelector = new WalletSelector(walletSDK);
const chainOptimizer = new ChainOptimizer();
const transactionRecordManager = new TransactionRecordManager();
const assetActivator = new AssetActivator(walletSDK, transactionModule);
const paymentOrchestrator = new PaymentOrchestrator(
  walletSelector,
  chainOptimizer,
  transactionModule,
  transactionMonitor
);
const rpcUrl = config.alchemyPolygonMumbaiRpc || config.polygonMumbaiRpcUrl;
const rpcProvider = new ethers.JsonRpcProvider(rpcUrl);
const backendWallet = config.web3ServicePrivateKey
  ? new ethers.Wallet(config.web3ServicePrivateKey, rpcProvider)
  : null;
let lastPaymentTxHash: string | null = null;

// 健康检查
app.get('/', (req: Request, res: Response) => {
  logger.debug('Root endpoint accessed');
  res.json({
    service: 'Voice-to-Pay Web3 Service',
    status: 'running',
    version: '0.1.0'
  });
});

app.get('/health', (req: Request, res: Response) => {
  logger.debug('Health check endpoint accessed');
  res.json({ status: 'healthy' });
});

// 钱包 API
app.post('/wallet/connect', async (req: Request, res: Response) => {
  try {
    const connection = await walletSDK.connect();
    res.json({ success: true, data: connection });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/wallet/switch-network', async (req: Request, res: Response) => {
  try {
    const { chainId } = req.body;
    await walletSDK.switchNetwork(chainId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/wallet/balance', async (req: Request, res: Response) => {
  try {
    const balance = await walletSDK.getBalance();
    res.json({ success: true, balance });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 交易 API
app.post('/transaction/estimate-gas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const estimate = await transactionModule.estimateGas(req.body);
    res.json({ success: true, data: estimate });
  } catch (error) {
    next(error);
  }
});

app.post('/transaction/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await transactionModule.sendTransaction(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

app.get('/transaction/status/:txHash', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { txHash } = req.params;
    let status = await transactionMonitor.pollStatus(txHash);

    if (!status) {
      const receipt = await rpcProvider.getTransactionReceipt(txHash);
      if (!receipt) {
        status = { hash: txHash, status: MonitorTxStatus.PENDING };
      } else {
        status = {
          hash: txHash,
          status: receipt.status === 1 ? MonitorTxStatus.CONFIRMED : MonitorTxStatus.FAILED,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed?.toString(),
          effectiveGasPrice: receipt.gasPrice?.toString()
        };
      }
    }

    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
});

// 交易记录 API
app.post('/transaction/record', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transactionId = await transactionRecordManager.createTransaction(req.body);
    res.json({ success: true, transactionId });
  } catch (error) {
    next(error);
  }
});

app.get('/transaction/record/:txHash', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { txHash } = req.params;
    const record = await transactionRecordManager.getTransactionByHash(txHash);
    
    if (!record) {
      res.status(404).json({ success: false, error: '交易记录未找到' });
      return;
    }
    
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

app.get('/transaction/records', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = {
      user_id: req.query.user_id as string,
      status: req.query.status as TxStatus,
      chain: req.query.chain as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0
    };
    
    const records = await transactionRecordManager.queryTransactions(filter);
    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
});

app.get('/transaction/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = {
      user_id: req.query.user_id as string,
      status: req.query.status as TxStatus
    };
    
    const format = (req.query.format as ExportFormat) || ExportFormat.JSON;
    const data = await transactionRecordManager.exportTransactions(filter, format);
    
    if (format === ExportFormat.CSV) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
    } else {
      res.setHeader('Content-Type', 'application/json');
    }
    
    res.send(data);
  } catch (error) {
    next(error);
  }
});

app.get('/transaction/stats/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const stats = await transactionRecordManager.getTransactionStats(userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// 支付编排 API
app.post('/payment/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { product, userAddress, productId, productName, amount, recipientAddress } = req.body;
    const resolvedProduct = product || {
      id: productId,
      name: productName,
      price: amount,
      contract_address: recipientAddress
    };
    const resolvedRecipient = resolvedProduct?.contract_address || recipientAddress;
    const rawAmount = resolvedProduct?.price || amount;

    if (!resolvedProduct?.name || !resolvedRecipient || !rawAmount) {
      throw ErrorHandler.validationError('支付请求缺少必要字段');
    }

    if (!backendWallet) {
      throw ErrorHandler.validationError('未配置服务端私钥');
    }

    const amountValue = typeof rawAmount === 'number'
      ? rawAmount.toString()
      : rawAmount.toString().replace(/,/g, '').match(/[\d.]+/)?.[0];

    if (!amountValue) {
      throw ErrorHandler.validationError('支付金额格式错误');
    }

    logger.info('Starting payment', { product: resolvedProduct.name, userAddress });

    const toAddress = ethers.getAddress(resolvedRecipient);
    const txResponse = await backendWallet.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amountValue)
    });

    lastPaymentTxHash = txResponse.hash;

    logger.info('Payment started', { txHash: txResponse.hash });

    res.json({
      success: true,
      message: '支付流程已启动',
      txHash: txResponse.hash
    });
  } catch (error: any) {
    logger.error('Payment start failed', error);
    next(error);
  }
});

app.post('/payment/confirm', async (req: Request, res: Response) => {
  try {
    if (!lastPaymentTxHash) {
      throw ErrorHandler.validationError('没有待确认的支付');
    }

    const receipt = await rpcProvider.waitForTransaction(lastPaymentTxHash, 1, 300000);
    if (!receipt) {
      throw new Error('交易确认超时');
    }

    const status = receipt.status === 1 ? 'CONFIRMED' : 'FAILED';
    res.json({
      success: receipt.status === 1,
      message: receipt.status === 1 ? '支付已确认' : '支付失败',
      txHash: lastPaymentTxHash,
      status,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString()
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/payment/cancel', (req: Request, res: Response) => {
  try {
    lastPaymentTxHash = null;
    res.json({ success: true, message: '支付已取消' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 链优化 API
app.get('/chains/supported', (req: Request, res: Response) => {
  const chains = chainOptimizer.getSupportedChains();
  res.json({ success: true, chains });
});

app.post('/chains/optimize', async (req: Request, res: Response) => {
  try {
    const { supportedChains, transactionValue } = req.body;
    const result = await chainOptimizer.optimizeTransaction(supportedChains, transactionValue);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 资产激活 API
app.post('/asset/query', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tokenAddress, tokenType } = req.body;
    const assetInfo = await assetActivator.queryAsset(tokenAddress, tokenType);
    res.json({ success: true, data: assetInfo });
  } catch (error) {
    next(error);
  }
});

app.post('/asset/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tokenAddress, tokenType } = req.body;
    const result = await assetActivator.activateAsset(tokenAddress, tokenType);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

app.post('/asset/query-multiple', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tokens } = req.body;
    const results = await assetActivator.queryMultipleAssets(tokens);
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

app.post('/asset/activate-multiple', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tokens } = req.body;
    const results = await assetActivator.activateMultipleAssets(tokens);
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

app.get('/asset/activation-history/:userAddress?', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress } = req.params;
    const history = await assetActivator.getActivationHistory(userAddress);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

// 404 处理
app.use((req: Request, res: Response) => {
  throw ErrorHandler.notFoundError('API 端点');
});

// 错误处理中间件（必须放在最后）
app.use(errorMiddleware);

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('收到 SIGTERM 信号，开始优雅关闭...');
  await pgPool.end();
  await redisClient.quit();
  logger.info('所有连接已关闭');
  process.exit(0);
});

// 启动服务器
const PORT = config.web3ServicePort;
app.listen(PORT, () => {
  logger.info(`✓ Web3 Service 运行在端口 ${PORT}`);
  logger.info(`✓ 环境: ${config.nodeEnv}`);
  logger.info(`✓ 数据库: ${config.postgresHost}:${config.postgresPort}`);
  logger.info(`✓ Redis: ${config.redisHost}:${config.redisPort}`);
});

export default app;
