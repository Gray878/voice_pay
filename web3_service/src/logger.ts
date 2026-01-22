/**
 * 日志系统
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// 日志级别
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

// 日志上下文
export interface LogContext {
  sessionId?: string;
  requestId?: string;
  userId?: string;
  txHash?: string;
  [key: string]: any;
}

// 创建日志目录
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 自定义格式化器
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, sessionId, requestId, ...meta }) => {
    let log = `${timestamp} - ${level.toUpperCase()}`;
    
    if (sessionId) {
      log += ` - [Session: ${sessionId}]`;
    }
    
    if (requestId) {
      log += ` - [Request: ${requestId}]`;
    }
    
    log += ` - ${message}`;
    
    // 添加额外的元数据
    const metaKeys = Object.keys(meta);
    if (metaKeys.length > 0) {
      log += ` - ${JSON.stringify(meta)}`;
    }
    
    return log;
  })
);

// JSON 格式化器
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 创建 Winston logger
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    }),
    
    // 通用日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      format: customFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: customFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    }),
    
    // JSON 格式日志（用于日志分析）
    new winston.transports.File({
      filename: path.join(logDir, 'app.json.log'),
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

/**
 * Logger 类
 * 提供带上下文的日志记录功能
 */
export class Logger {
  private context: LogContext;
  private moduleName: string;

  constructor(moduleName: string, context: LogContext = {}) {
    this.moduleName = moduleName;
    this.context = context;
  }

  /**
   * 设置会话 ID
   */
  setSessionId(sessionId: string): void {
    this.context.sessionId = sessionId;
  }

  /**
   * 设置请求 ID
   */
  setRequestId(requestId: string): void {
    this.context.requestId = requestId;
  }

  /**
   * 更新上下文
   */
  updateContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * 记录 debug 日志
   */
  debug(message: string, meta?: any): void {
    winstonLogger.debug(message, {
      module: this.moduleName,
      ...this.context,
      ...meta
    });
  }

  /**
   * 记录 info 日志
   */
  info(message: string, meta?: any): void {
    winstonLogger.info(message, {
      module: this.moduleName,
      ...this.context,
      ...meta
    });
  }

  /**
   * 记录 warn 日志
   */
  warn(message: string, meta?: any): void {
    winstonLogger.warn(message, {
      module: this.moduleName,
      ...this.context,
      ...meta
    });
  }

  /**
   * 记录 error 日志
   */
  error(message: string, error?: Error, meta?: any): void {
    winstonLogger.error(message, {
      module: this.moduleName,
      ...this.context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined,
      ...meta
    });
  }

  /**
   * 创建子 logger
   */
  child(context: Partial<LogContext>): Logger {
    return new Logger(this.moduleName, { ...this.context, ...context });
  }
}

/**
 * 创建 logger 实例
 */
export function createLogger(moduleName: string, context?: LogContext): Logger {
  return new Logger(moduleName, context);
}

/**
 * 日志查询工具
 */
export class LogQuery {
  private logDir: string;

  constructor(logDir: string = path.join(__dirname, '../../logs')) {
    this.logDir = logDir;
  }

  /**
   * 根据会话 ID 查询日志
   */
  async queryBySession(sessionId: string): Promise<string[]> {
    const logFile = path.join(this.logDir, 'app.log');
    
    if (!fs.existsSync(logFile)) {
      return [];
    }

    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.split('\n');
    
    return lines.filter(line => line.includes(sessionId));
  }

  /**
   * 查询错误日志
   */
  async queryErrors(limit: number = 100): Promise<string[]> {
    const errorFile = path.join(this.logDir, 'error.log');
    
    if (!fs.existsSync(errorFile)) {
      return [];
    }

    const content = fs.readFileSync(errorFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.slice(-limit);
  }

  /**
   * 根据交易哈希查询日志
   */
  async queryByTxHash(txHash: string): Promise<string[]> {
    const logFile = path.join(this.logDir, 'app.log');
    
    if (!fs.existsSync(logFile)) {
      return [];
    }

    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.split('\n');
    
    return lines.filter(line => line.includes(txHash));
  }
}

// 导出默认 logger
export const logger = createLogger('App');
