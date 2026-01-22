/**
 * TransactionRecord - 交易记录管理模块
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.7
 * 
 * 功能：
 * - 创建交易记录
 * - 更新交易状态
 * - 查询交易记录（支持过滤）
 * - 导出交易记录（JSON/CSV）
 */

import { Pool, QueryResult } from 'pg';
import { config, getPostgresUrl } from './config';

// 交易状态枚举
export enum TxStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// 交易记录接口
export interface TransactionRecord {
  id?: number;
  user_id: string;
  session_id: string;
  tx_hash: string;
  from_address: string;
  to_address: string;
  value: string;
  gas_used?: string;
  gas_price?: string;
  status: TxStatus;
  product_id?: string;
  product_name?: string;
  chain: string;
  block_number?: number;
  error_message?: string;
  created_at?: Date;
  updated_at?: Date;
}

// 查询过滤器
export interface TransactionFilter {
  user_id?: string;
  session_id?: string;
  status?: TxStatus;
  chain?: string;
  from_date?: Date;
  to_date?: Date;
  limit?: number;
  offset?: number;
}

// 导出格式
export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv'
}

export class TransactionRecordManager {
  private pool: Pool;

  constructor() {
    // 初始化数据库连接池
    this.pool = new Pool({
      connectionString: getPostgresUrl(),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err: Error) => {
      console.error('数据库连接池错误:', err);
    });
  }

  /**
   * 创建交易记录
   * Requirements: 16.1, 16.2
   */
  async createTransaction(record: TransactionRecord): Promise<TransactionRecord> {
    const query = `
      INSERT INTO transactions (
        user_id, session_id, tx_hash, from_address, to_address,
        value, gas_used, gas_price, status, product_id, product_name,
        chain, block_number, error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      record.user_id,
      record.session_id,
      record.tx_hash,
      record.from_address,
      record.to_address,
      record.value,
      record.gas_used || null,
      record.gas_price || null,
      record.status,
      record.product_id || null,
      record.product_name || null,
      record.chain,
      record.block_number || null,
      record.error_message || null
    ];

    try {
      const result: QueryResult = await this.pool.query(query, values);
      return this.mapRowToRecord(result.rows[0]);
    } catch (error: any) {
      throw new Error(`创建交易记录失败: ${error.message}`);
    }
  }

  /**
   * 更新交易状态
   * Requirements: 16.3
   */
  async updateTransactionStatus(
    tx_hash: string,
    status: TxStatus,
    additional_data?: {
      gas_used?: string;
      block_number?: number;
      error_message?: string;
    }
  ): Promise<TransactionRecord> {
    const updates: string[] = ['status = $2', 'updated_at = NOW()'];
    const values: any[] = [tx_hash, status];
    let paramIndex = 3;

    if (additional_data?.gas_used) {
      updates.push(`gas_used = $${paramIndex}`);
      values.push(additional_data.gas_used);
      paramIndex++;
    }

    if (additional_data?.block_number) {
      updates.push(`block_number = $${paramIndex}`);
      values.push(additional_data.block_number);
      paramIndex++;
    }

    if (additional_data?.error_message) {
      updates.push(`error_message = $${paramIndex}`);
      values.push(additional_data.error_message);
      paramIndex++;
    }

    const query = `
      UPDATE transactions
      SET ${updates.join(', ')}
      WHERE tx_hash = $1
      RETURNING *
    `;

    try {
      const result: QueryResult = await this.pool.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error(`未找到交易记录: ${tx_hash}`);
      }

      return this.mapRowToRecord(result.rows[0]);
    } catch (error: any) {
      throw new Error(`更新交易状态失败: ${error.message}`);
    }
  }

  /**
   * 查询交易记录
   * Requirements: 16.4
   */
  async queryTransactions(filter: TransactionFilter = {}): Promise<TransactionRecord[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // 构建查询条件
    if (filter.user_id) {
      conditions.push(`user_id = $${paramIndex}`);
      values.push(filter.user_id);
      paramIndex++;
    }

    if (filter.session_id) {
      conditions.push(`session_id = $${paramIndex}`);
      values.push(filter.session_id);
      paramIndex++;
    }

    if (filter.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filter.status);
      paramIndex++;
    }

    if (filter.chain) {
      conditions.push(`chain = $${paramIndex}`);
      values.push(filter.chain);
      paramIndex++;
    }

    if (filter.from_date) {
      conditions.push(`created_at >= $${paramIndex}`);
      values.push(filter.from_date);
      paramIndex++;
    }

    if (filter.to_date) {
      conditions.push(`created_at <= $${paramIndex}`);
      values.push(filter.to_date);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit || 100;
    const offset = filter.offset || 0;

    const query = `
      SELECT * FROM transactions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    try {
      const result: QueryResult = await this.pool.query(query, values);
      return result.rows.map((row: any) => this.mapRowToRecord(row));
    } catch (error: any) {
      throw new Error(`查询交易记录失败: ${error.message}`);
    }
  }

  /**
   * 根据交易哈希查询单条记录
   * Requirements: 16.4
   */
  async getTransactionByHash(tx_hash: string): Promise<TransactionRecord | null> {
    const query = 'SELECT * FROM transactions WHERE tx_hash = $1';

    try {
      const result: QueryResult = await this.pool.query(query, [tx_hash]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToRecord(result.rows[0]);
    } catch (error: any) {
      throw new Error(`查询交易记录失败: ${error.message}`);
    }
  }

  /**
   * 导出交易记录
   * Requirements: 16.5, 16.7
   */
  async exportTransactions(
    filter: TransactionFilter = {},
    format: ExportFormat = ExportFormat.JSON
  ): Promise<string> {
    const transactions = await this.queryTransactions(filter);

    if (format === ExportFormat.JSON) {
      return this.exportToJSON(transactions);
    } else if (format === ExportFormat.CSV) {
      return this.exportToCSV(transactions);
    } else {
      throw new Error(`不支持的导出格式: ${format}`);
    }
  }

  /**
   * 导出为 JSON 格式
   */
  private exportToJSON(transactions: TransactionRecord[]): string {
    return JSON.stringify(transactions, null, 2);
  }

  /**
   * 导出为 CSV 格式
   */
  private exportToCSV(transactions: TransactionRecord[]): string {
    if (transactions.length === 0) {
      return '';
    }

    // CSV 表头
    const headers = [
      'ID', 'User ID', 'Session ID', 'TX Hash', 'From', 'To',
      'Value', 'Gas Used', 'Gas Price', 'Status', 'Product ID',
      'Product Name', 'Chain', 'Block Number', 'Error Message',
      'Created At', 'Updated At'
    ];

    const csvRows: string[] = [headers.join(',')];

    // CSV 数据行
    for (const tx of transactions) {
      const row = [
        tx.id || '',
        this.escapeCsvValue(tx.user_id),
        this.escapeCsvValue(tx.session_id),
        this.escapeCsvValue(tx.tx_hash),
        this.escapeCsvValue(tx.from_address),
        this.escapeCsvValue(tx.to_address),
        tx.value,
        tx.gas_used || '',
        tx.gas_price || '',
        tx.status,
        tx.product_id || '',
        this.escapeCsvValue(tx.product_name || ''),
        tx.chain,
        tx.block_number || '',
        this.escapeCsvValue(tx.error_message || ''),
        tx.created_at?.toISOString() || '',
        tx.updated_at?.toISOString() || ''
      ];

      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * 转义 CSV 值
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * 获取交易统计信息
   * Requirements: 16.7
   */
  async getTransactionStats(user_id?: string): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    failed: number;
    total_value: string;
  }> {
    const whereClause = user_id ? 'WHERE user_id = $1' : '';
    const values = user_id ? [user_id] : [];

    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COALESCE(SUM(CAST(value AS NUMERIC)), 0) as total_value
      FROM transactions
      ${whereClause}
    `;

    try {
      const result: QueryResult = await this.pool.query(query, values);
      const row = result.rows[0];

      return {
        total: parseInt(row.total, 10),
        pending: parseInt(row.pending, 10),
        confirmed: parseInt(row.confirmed, 10),
        failed: parseInt(row.failed, 10),
        total_value: row.total_value.toString()
      };
    } catch (error: any) {
      throw new Error(`获取交易统计失败: ${error.message}`);
    }
  }

  /**
   * 删除旧交易记录
   * Requirements: 16.7
   */
  async deleteOldTransactions(days: number = 90): Promise<number> {
    const query = `
      DELETE FROM transactions
      WHERE created_at < NOW() - INTERVAL '${days} days'
      RETURNING id
    `;

    try {
      const result: QueryResult = await this.pool.query(query);
      return result.rowCount || 0;
    } catch (error: any) {
      throw new Error(`删除旧交易记录失败: ${error.message}`);
    }
  }

  /**
   * 映射数据库行到交易记录对象
   */
  private mapRowToRecord(row: any): TransactionRecord {
    return {
      id: row.id,
      user_id: row.user_id,
      session_id: row.session_id,
      tx_hash: row.tx_hash,
      from_address: row.from_address,
      to_address: row.to_address,
      value: row.value,
      gas_used: row.gas_used,
      gas_price: row.gas_price,
      status: row.status as TxStatus,
      product_id: row.product_id,
      product_name: row.product_name,
      chain: row.chain,
      block_number: row.block_number,
      error_message: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * 关闭数据库连接池
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
