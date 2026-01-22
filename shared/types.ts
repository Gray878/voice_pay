/**
 * Voice-to-Pay 系统数据模型定义
 * 包含所有核心数据结构和枚举类型
 */

// ==================== 枚举类型 ====================

/**
 * 用户意图类型
 * 用于分类用户的语音输入意图
 */
export enum IntentType {
  QUERY = "query",           // 查询商品
  PURCHASE = "purchase",     // 购买商品
  CONFIRM = "confirm",       // 确认交易
  CANCEL = "cancel",         // 取消交易
  HELP = "help",             // 请求帮助
  HISTORY = "history"        // 查询历史
}

/**
 * 支付流程状态
 * 用于跟踪支付流程的各个阶段
 */
export enum PaymentState {
  IDLE = "idle",                           // 空闲状态
  WALLET_SELECTION = "wallet_selection",   // 钱包选择中
  TRANSACTION_PREVIEW = "transaction_preview", // 交易预览
  USER_CONFIRMATION = "user_confirmation", // 等待用户确认
  SIGNING = "signing",                     // 签名中
  BROADCASTING = "broadcasting",           // 广播交易中
  CONFIRMING = "confirming",               // 等待链上确认
  COMPLETED = "completed",                 // 已完成
  FAILED = "failed"                        // 失败
}

/**
 * 交易状态
 * 用于跟踪链上交易的状态
 */
export enum TxStatus {
  PENDING = "pending",       // 待确认
  CONFIRMED = "confirmed",   // 已确认
  FAILED = "failed"          // 失败
}

// ==================== 数据接口 ====================

/**
 * 商品实体接口
 * 表示 NFT 或 Token 商品的结构化信息
 */
export interface Product {
  id: string;                              // 商品唯一标识
  name: string;                            // 商品名称
  description: string;                     // 商品描述
  category: "NFT" | "Token";               // 商品类别
  price: string;                           // 价格（字符串格式，避免精度问题）
  currency: string;                        // 币种（如 MATIC, ETH）
  chain: string;                           // 所在区块链网络
  contractAddress: string;                 // 合约地址
  tokenId?: string;                        // Token ID（NFT 专用）
  metadata: {                              // 元数据
    image?: string;                        // 商品图片 URL
    attributes?: Record<string, any>;      // 其他属性
  };
  createdAt: Date;                         // 创建时间
  updatedAt: Date;                         // 更新时间
}

/**
 * 交易记录接口
 * 存储交易历史和状态信息
 */
export interface Transaction {
  id: string;                              // 交易记录唯一标识
  userId: string;                          // 用户 ID
  sessionId: string;                       // 会话 ID
  productId: string;                       // 商品 ID
  txHash: string;                          // 交易哈希
  status: TxStatus;                        // 交易状态
  chain: string;                           // 区块链网络
  fromAddress: string;                     // 发送方地址
  toAddress: string;                       // 接收方地址（合约地址）
  value: string;                           // 交易金额
  gasFee: string;                          // Gas 费用
  createdAt: Date;                         // 创建时间
  confirmedAt?: Date;                      // 确认时间
}

/**
 * 用户接口
 * 存储用户基本信息和偏好设置
 */
export interface User {
  id: string;                              // 用户唯一标识
  walletAddresses: string[];               // 用户的钱包地址列表
  preferredWallet?: string;                // 首选钱包地址
  preferredChain?: string;                 // 首选区块链网络
  transactionHistory: string[];            // 交易历史 ID 列表
  createdAt: Date;                         // 创建时间
}

/**
 * 用户会话接口
 * 维护单次语音交互的上下文状态
 */
export interface UserSession {
  sessionId: string;                       // 会话唯一标识
  userId: string;                          // 用户 ID
  conversationHistory: Array<{             // 对话历史
    role: "user" | "assistant";            // 角色
    content: string;                       // 内容
    timestamp: Date;                       // 时间戳
  }>;
  selectedProducts: Product[];             // 已选择的商品列表
  currentState: PaymentState;              // 当前支付流程状态
  context: Record<string, any>;            // 额外上下文数据
  createdAt: Date;                         // 创建时间
  expiresAt: Date;                         // 过期时间
}

// ==================== 辅助类型 ====================

/**
 * ASR 识别结果
 */
export interface ASRResult {
  text: string;                            // 识别的文本
  confidence: number;                      // 置信度 (0-1)
  language: string;                        // 语言
  duration?: number;                       // 处理时长（秒）
}

/**
 * 解析后的用户意图
 */
export interface ParsedIntent {
  intent: IntentType;                      // 意图类型
  entities: Record<string, any>;           // 提取的实体
  confidence: number;                      // 置信度
  missingInfo?: string[];                  // 缺失的必要信息
}

/**
 * 钱包信息
 */
export interface WalletInfo {
  address: string;                         // 钱包地址
  provider: string;                        // 钱包提供商（如 MetaMask）
  chainId: string;                         // 当前链 ID
  balance: Record<string, string>;         // 各币种余额
}

/**
 * 交易摘要
 */
export interface TransactionSummary {
  product: Product;                        // 商品信息
  price: string;                           // 商品价格
  gasFee: string;                          // Gas 费用
  total: string;                           // 总计
  currency: string;                        // 币种
}

/**
 * 链路优化结果
 */
export interface OptimizationResult {
  recommendedChain: string;                // 推荐的区块链网络
  gasLimit: string;                        // Gas 限制
  maxFeePerGas: string;                    // 最大 Gas 价格
  estimatedCost: string;                   // 预估成本
}

/**
 * 安全检查报告
 */
export interface SecurityReport {
  isSafe: boolean;                         // 是否安全
  riskLevel: "low" | "medium" | "high";    // 风险等级
  warnings: string[];                      // 警告信息列表
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  code: string;                            // 错误代码
  message: string;                         // 用户友好的错误消息
  details?: any;                           // 详细错误信息
  suggestions?: string[];                  // 建议的解决方案
  retryable: boolean;                      // 是否可重试
}
