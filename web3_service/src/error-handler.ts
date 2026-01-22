/**
 * ErrorHandler - 统一错误处理模块
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
 */

// 错误类型枚举
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  WALLET_ERROR = 'WALLET_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR'
}

// 错误严重级别
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// 标准错误响应接口
export interface ErrorResponse {
  success: false;
  error: {
    type: ErrorType;
    code: string;
    message: string;
    userMessage: string;
    details?: any;
    timestamp: string;
    requestId?: string;
    severity: ErrorSeverity;
  };
}

// 应用错误类
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly code: string;
  public readonly userMessage: string;
  public readonly details?: any;
  public readonly severity: ErrorSeverity;
  public readonly isOperational: boolean;

  constructor(
    type: ErrorType,
    code: string,
    message: string,
    userMessage: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.type = type;
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;
    this.severity = severity;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * ErrorHandler 类
 * 统一处理和格式化错误
 */
export class ErrorHandler {
  /**
   * 将错误转换为标准响应格式
   * Requirements: 13.1, 13.2
   */
  static toErrorResponse(error: Error | AppError, requestId?: string): ErrorResponse {
    if (error instanceof AppError) {
      return {
        success: false,
        error: {
          type: error.type,
          code: error.code,
          message: error.message,
          userMessage: error.userMessage,
          details: error.details,
          timestamp: new Date().toISOString(),
          requestId,
          severity: error.severity
        }
      };
    }

    // 处理未知错误
    const mappedError = this.mapUnknownError(error);
    return {
      success: false,
      error: {
        type: mappedError.type,
        code: mappedError.code,
        message: error.message,
        userMessage: mappedError.userMessage,
        details: { originalError: error.name },
        timestamp: new Date().toISOString(),
        requestId,
        severity: ErrorSeverity.HIGH
      }
    };
  }

  /**
   * 映射未知错误到标准错误类型
   * Requirements: 13.3
   */
  private static mapUnknownError(error: Error): {
    type: ErrorType;
    code: string;
    userMessage: string;
  } {
    const errorMessage = error.message.toLowerCase();

    // 网络错误
    if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('econnrefused')) {
      return {
        type: ErrorType.NETWORK_ERROR,
        code: 'NETWORK_ERROR',
        userMessage: '网络连接失败，请检查网络设置后重试'
      };
    }

    // 数据库错误
    if (errorMessage.includes('database') || errorMessage.includes('sql') || errorMessage.includes('query')) {
      return {
        type: ErrorType.DATABASE_ERROR,
        code: 'DATABASE_ERROR',
        userMessage: '数据存储服务暂时不可用，请稍后重试'
      };
    }

    // 超时错误
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return {
        type: ErrorType.TIMEOUT_ERROR,
        code: 'TIMEOUT_ERROR',
        userMessage: '操作超时，请稍后重试'
      };
    }

    // 默认内部错误
    return {
      type: ErrorType.INTERNAL_ERROR,
      code: 'INTERNAL_ERROR',
      userMessage: '系统遇到了一些问题，我们正在处理中'
    };
  }

  /**
   * 创建验证错误
   * Requirements: 13.4
   */
  static validationError(message: string, details?: any): AppError {
    return new AppError(
      ErrorType.VALIDATION_ERROR,
      'VALIDATION_ERROR',
      message,
      '输入的信息有误，请检查后重试',
      ErrorSeverity.LOW,
      details
    );
  }

  /**
   * 创建钱包错误
   * Requirements: 13.5
   */
  static walletError(code: string, message: string, userMessage: string, details?: any): AppError {
    return new AppError(
      ErrorType.WALLET_ERROR,
      code,
      message,
      userMessage,
      ErrorSeverity.MEDIUM,
      details
    );
  }

  /**
   * 创建交易错误
   * Requirements: 13.6
   */
  static transactionError(code: string, message: string, userMessage: string, details?: any): AppError {
    return new AppError(
      ErrorType.TRANSACTION_ERROR,
      code,
      message,
      userMessage,
      ErrorSeverity.HIGH,
      details
    );
  }

  /**
   * 创建网络错误
   */
  static networkError(message: string, details?: any): AppError {
    return new AppError(
      ErrorType.NETWORK_ERROR,
      'NETWORK_ERROR',
      message,
      '网络连接失败，请检查网络设置',
      ErrorSeverity.MEDIUM,
      details
    );
  }

  /**
   * 创建合约错误
   */
  static contractError(message: string, userMessage: string, details?: any): AppError {
    return new AppError(
      ErrorType.CONTRACT_ERROR,
      'CONTRACT_ERROR',
      message,
      userMessage,
      ErrorSeverity.HIGH,
      details
    );
  }

  /**
   * 创建未找到错误
   */
  static notFoundError(resource: string): AppError {
    return new AppError(
      ErrorType.NOT_FOUND_ERROR,
      'NOT_FOUND',
      `${resource} not found`,
      `未找到${resource}`,
      ErrorSeverity.LOW
    );
  }

  /**
   * 创建认证错误
   */
  static authenticationError(message: string = 'Authentication required'): AppError {
    return new AppError(
      ErrorType.AUTHENTICATION_ERROR,
      'AUTHENTICATION_ERROR',
      message,
      '需要登录才能继续操作',
      ErrorSeverity.MEDIUM
    );
  }

  /**
   * 创建授权错误
   */
  static authorizationError(message: string = 'Insufficient permissions'): AppError {
    return new AppError(
      ErrorType.AUTHORIZATION_ERROR,
      'AUTHORIZATION_ERROR',
      message,
      '您没有权限执行此操作',
      ErrorSeverity.MEDIUM
    );
  }

  /**
   * 创建限流错误
   */
  static rateLimitError(retryAfter?: number): AppError {
    return new AppError(
      ErrorType.RATE_LIMIT_ERROR,
      'RATE_LIMIT_ERROR',
      'Rate limit exceeded',
      '操作过于频繁，请稍后再试',
      ErrorSeverity.LOW,
      { retryAfter }
    );
  }

  /**
   * 判断错误是否可操作（可恢复）
   * Requirements: 13.7
   */
  static isOperationalError(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }

  /**
   * 记录错误日志
   * Requirements: 13.7
   */
  static logError(error: Error | AppError, context?: any): void {
    const timestamp = new Date().toISOString();

    if (error instanceof AppError) {
      console.error(`[${timestamp}] [${error.severity.toUpperCase()}] ${error.type}:`, {
        code: error.code,
        message: error.message,
        userMessage: error.userMessage,
        details: error.details,
        context,
        stack: error.stack
      });
    } else {
      console.error(`[${timestamp}] [ERROR] Unhandled Error:`, {
        name: error.name,
        message: error.message,
        context,
        stack: error.stack
      });
    }
  }
}

// 常见错误消息映射
export const ERROR_MESSAGES = {
  // 钱包错误
  WALLET_NOT_CONNECTED: '钱包未连接，请先连接钱包',
  WALLET_NOT_INSTALLED: '未检测到钱包，请安装 MetaMask',
  USER_REJECTED: '您取消了操作',
  INSUFFICIENT_BALANCE: '余额不足，无法完成交易',
  WRONG_NETWORK: '请切换到正确的网络',

  // 交易错误
  TRANSACTION_FAILED: '交易失败，请重试',
  GAS_ESTIMATION_FAILED: '无法估算 Gas 费用',
  TRANSACTION_TIMEOUT: '交易超时，请稍后查看交易状态',
  NONCE_TOO_LOW: '交易序号错误，请刷新后重试',

  // 合约错误
  CONTRACT_NOT_FOUND: '合约地址无效',
  CONTRACT_EXECUTION_FAILED: '合约执行失败',
  CONTRACT_BLACKLISTED: '该合约地址存在安全风险',

  // 验证错误
  INVALID_ADDRESS: '钱包地址格式不正确',
  INVALID_AMOUNT: '金额格式不正确',
  INVALID_PRODUCT: '商品信息无效',

  // 系统错误
  INTERNAL_ERROR: '系统遇到了一些问题，请稍后重试',
  SERVICE_UNAVAILABLE: '服务暂时不可用，请稍后重试',
  DATABASE_ERROR: '数据存储服务异常'
};

// Express 中间件：错误处理
export function errorMiddleware(err: Error, req: any, res: any, next: any) {
  ErrorHandler.logError(err, {
    method: req.method,
    url: req.url,
    body: req.body,
    params: req.params,
    query: req.query
  });

  const errorResponse = ErrorHandler.toErrorResponse(err, req.id);

  // 根据错误类型设置 HTTP 状态码
  let statusCode = 500;
  if (err instanceof AppError) {
    switch (err.type) {
      case ErrorType.VALIDATION_ERROR:
        statusCode = 400;
        break;
      case ErrorType.AUTHENTICATION_ERROR:
        statusCode = 401;
        break;
      case ErrorType.AUTHORIZATION_ERROR:
        statusCode = 403;
        break;
      case ErrorType.NOT_FOUND_ERROR:
        statusCode = 404;
        break;
      case ErrorType.RATE_LIMIT_ERROR:
        statusCode = 429;
        break;
      case ErrorType.NETWORK_ERROR:
      case ErrorType.TIMEOUT_ERROR:
        statusCode = 503;
        break;
      default:
        statusCode = 500;
    }
  }

  res.status(statusCode).json(errorResponse);
}
