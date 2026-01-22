"""
日志系统配置
Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7
"""

import logging
import sys
from pathlib import Path
from typing import Optional
from datetime import datetime
import json


class SessionContextFilter(logging.Filter):
    """会话上下文过滤器，为日志添加 session_id"""
    
    def __init__(self):
        super().__init__()
        self.session_id: Optional[str] = None
    
    def filter(self, record):
        record.session_id = self.session_id or "N/A"
        return True


class JSONFormatter(logging.Formatter):
    """JSON 格式化器"""
    
    def format(self, record):
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "session_id": getattr(record, "session_id", "N/A"),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # 添加额外字段
        if hasattr(record, "error_code"):
            log_data["error_code"] = record.error_code
        
        if hasattr(record, "details"):
            log_data["details"] = record.details
        
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        
        # 添加异常信息
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(log_data, ensure_ascii=False)


def setup_logging(
    log_level: str = "INFO",
    log_dir: Optional[str] = None,
    enable_json: bool = False
) -> logging.Logger:
    """
    配置日志系统
    
    Args:
        log_level: 日志级别 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_dir: 日志目录路径
        enable_json: 是否启用 JSON 格式
        
    Returns:
        配置好的 logger 对象
    """
    # 创建根 logger
    logger = logging.getLogger()
    logger.setLevel(getattr(logging, log_level.upper()))
    
    # 清除现有的 handlers
    logger.handlers.clear()
    
    # 添加会话上下文过滤器
    session_filter = SessionContextFilter()
    
    # 控制台 handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    
    if enable_json:
        console_formatter = JSONFormatter()
    else:
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - [%(session_id)s] - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    console_handler.setFormatter(console_formatter)
    console_handler.addFilter(session_filter)
    logger.addHandler(console_handler)
    
    # 文件 handler（如果指定了日志目录）
    if log_dir:
        log_path = Path(log_dir)
        log_path.mkdir(parents=True, exist_ok=True)
        
        # 通用日志文件
        file_handler = logging.FileHandler(
            log_path / f"app_{datetime.now().strftime('%Y%m%d')}.log",
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)
        
        if enable_json:
            file_formatter = JSONFormatter()
        else:
            file_formatter = logging.Formatter(
                '%(asctime)s - %(name)s - [%(session_id)s] - %(levelname)s - '
                '%(module)s:%(funcName)s:%(lineno)d - %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
        
        file_handler.setFormatter(file_formatter)
        file_handler.addFilter(session_filter)
        logger.addHandler(file_handler)
        
        # 错误日志文件
        error_handler = logging.FileHandler(
            log_path / f"error_{datetime.now().strftime('%Y%m%d')}.log",
            encoding='utf-8'
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(file_formatter)
        error_handler.addFilter(session_filter)
        logger.addHandler(error_handler)
    
    # 存储 session_filter 以便后续更新
    logger.session_filter = session_filter
    
    return logger


def set_session_id(session_id: str):
    """
    设置当前会话 ID
    
    Args:
        session_id: 会话 ID
    """
    logger = logging.getLogger()
    if hasattr(logger, 'session_filter'):
        logger.session_filter.session_id = session_id


def clear_session_id():
    """清除当前会话 ID"""
    logger = logging.getLogger()
    if hasattr(logger, 'session_filter'):
        logger.session_filter.session_id = None


class LoggerAdapter(logging.LoggerAdapter):
    """日志适配器，自动添加上下文信息"""
    
    def process(self, msg, kwargs):
        # 添加额外的上下文信息
        if 'extra' not in kwargs:
            kwargs['extra'] = {}
        
        kwargs['extra'].update(self.extra)
        return msg, kwargs


def get_logger(name: str, **context) -> LoggerAdapter:
    """
    获取带上下文的 logger
    
    Args:
        name: logger 名称
        **context: 上下文信息
        
    Returns:
        LoggerAdapter 对象
    """
    logger = logging.getLogger(name)
    return LoggerAdapter(logger, context)


# 日志查询接口
class LogQuery:
    """日志查询工具"""
    
    def __init__(self, log_dir: str):
        """
        初始化日志查询工具
        
        Args:
            log_dir: 日志目录路径
        """
        self.log_dir = Path(log_dir)
    
    def query_by_session(
        self,
        session_id: str,
        date: Optional[str] = None
    ) -> list:
        """
        根据会话 ID 查询日志
        
        Args:
            session_id: 会话 ID
            date: 日期 (YYYYMMDD)，默认今天
            
        Returns:
            日志记录列表
        """
        if not date:
            date = datetime.now().strftime('%Y%m%d')
        
        log_file = self.log_dir / f"app_{date}.log"
        
        if not log_file.exists():
            return []
        
        results = []
        with open(log_file, 'r', encoding='utf-8') as f:
            for line in f:
                if session_id in line:
                    results.append(line.strip())
        
        return results
    
    def query_errors(
        self,
        date: Optional[str] = None,
        limit: int = 100
    ) -> list:
        """
        查询错误日志
        
        Args:
            date: 日期 (YYYYMMDD)，默认今天
            limit: 返回记录数限制
            
        Returns:
            错误日志列表
        """
        if not date:
            date = datetime.now().strftime('%Y%m%d')
        
        error_file = self.log_dir / f"error_{date}.log"
        
        if not error_file.exists():
            return []
        
        results = []
        with open(error_file, 'r', encoding='utf-8') as f:
            for line in f:
                results.append(line.strip())
                if len(results) >= limit:
                    break
        
        return results
