"""
统一错误处理模块
Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
"""

from typing import Optional, Dict, Any
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class ErrorCode(Enum):
    """错误代码枚举"""
    # 通用错误 (1xxx)
    UNKNOWN_ERROR = 1000
    INVALID_INPUT = 1001
    MISSING_PARAMETER = 1002
    INVALID_PARAMETER = 1003
    
    # 语音处理错误 (2xxx)
    VOICE_INPUT_ERROR = 2000
    ASR_ERROR = 2001
    AUDIO_DEVICE_ERROR = 2002
    
    # 语义解析错误 (3xxx)
    SEMANTIC_PARSE_ERROR = 3000
    INTENT_RECOGNITION_ERROR = 3001
    ENTITY_EXTRACTION_ERROR = 3002
    
    # 知识库错误 (4xxx)
    KNOWLEDGE_BASE_ERROR = 4000
    PRODUCT_NOT_FOUND = 4001
    SEARCH_ERROR = 4002
    
    # 会话错误 (5xxx)
    SESSION_ERROR = 5000
    SESSION_NOT_FOUND = 5001
    SESSION_EXPIRED = 5002
    
    # LLM 错误 (6xxx)
    LLM_ERROR = 6000
    LLM_API_ERROR = 6001
    LLM_TIMEOUT = 6002
    LLM_RATE_LIMIT = 6003


class AppError(Exception):
    """应用错误基类"""
    
    def __init__(
        self,
        code: ErrorCode,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        user_message: Optional[str] = None
    ):
        """
        初始化应用错误
        
        Args:
            code: 错误代码
            message: 技术错误消息（用于日志）
            details: 错误详情
            user_message: 用户友好的错误消息
        """
        self.code = code
        self.message = message
        self.details = details or {}
        self.user_message = user_message or self._get_default_user_message(code)
        
        super().__init__(self.message)
    
    def _get_default_user_message(self, code: ErrorCode) -> str:
        """获取默认的用户友好消息"""
        messages = {
            ErrorCode.UNKNOWN_ERROR: "抱歉，系统出现了未知错误",
            ErrorCode.INVALID_INPUT: "输入格式不正确，请重试",
            ErrorCode.MISSING_PARAMETER: "缺少必要的参数",
            ErrorCode.INVALID_PARAMETER: "参数值无效",
            
            ErrorCode.VOICE_INPUT_ERROR: "语音输入失败，请重试",
            ErrorCode.ASR_ERROR: "语音识别失败，请说清楚一些",
            ErrorCode.AUDIO_DEVICE_ERROR: "无法访问麦克风，请检查权限",
            
            ErrorCode.SEMANTIC_PARSE_ERROR: "无法理解您的意思，请换个说法",
            ErrorCode.INTENT_RECOGNITION_ERROR: "无法识别您的意图",
            ErrorCode.ENTITY_EXTRACTION_ERROR: "无法提取关键信息",
            
            ErrorCode.KNOWLEDGE_BASE_ERROR: "商品查询失败",
            ErrorCode.PRODUCT_NOT_FOUND: "没有找到相关商品",
            ErrorCode.SEARCH_ERROR: "搜索失败，请重试",
            
            ErrorCode.SESSION_ERROR: "会话错误",
            ErrorCode.SESSION_NOT_FOUND: "会话不存在",
            ErrorCode.SESSION_EXPIRED: "会话已过期，请重新开始",
            
            ErrorCode.LLM_ERROR: "AI 处理失败",
            ErrorCode.LLM_API_ERROR: "AI 服务暂时不可用",
            ErrorCode.LLM_TIMEOUT: "AI 处理超时，请重试",
            ErrorCode.LLM_RATE_LIMIT: "请求过于频繁，请稍后再试"
        }
        return messages.get(code, "系统错误")
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "error": {
                "code": self.code.value,
                "message": self.message,
                "user_message": self.user_message,
                "details": self.details
            }
        }


class ErrorResponse:
    """标准错误响应"""
    
    @staticmethod
    def create(
        error: AppError,
        request_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        创建标准错误响应
        
        Args:
            error: 应用错误对象
            request_id: 请求 ID
            
        Returns:
            标准错误响应字典
        """
        response = {
            "success": False,
            "error": {
                "code": error.code.value,
                "message": error.user_message,
                "details": error.details
            }
        }
        
        if request_id:
            response["request_id"] = request_id
        
        # 记录错误日志
        logger.error(
            f"Error {error.code.value}: {error.message}",
            extra={
                "error_code": error.code.value,
                "details": error.details,
                "request_id": request_id
            }
        )
        
        return response
    
    @staticmethod
    def from_exception(
        exception: Exception,
        request_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        从异常创建错误响应
        
        Args:
            exception: 异常对象
            request_id: 请求 ID
            
        Returns:
            标准错误响应字典
        """
        if isinstance(exception, AppError):
            return ErrorResponse.create(exception, request_id)
        
        # 未知错误
        error = AppError(
            code=ErrorCode.UNKNOWN_ERROR,
            message=str(exception),
            details={"exception_type": type(exception).__name__}
        )
        
        return ErrorResponse.create(error, request_id)


# 便捷的错误创建函数
def invalid_input_error(message: str, details: Optional[Dict] = None) -> AppError:
    """创建无效输入错误"""
    return AppError(ErrorCode.INVALID_INPUT, message, details)


def voice_input_error(message: str, details: Optional[Dict] = None) -> AppError:
    """创建语音输入错误"""
    return AppError(ErrorCode.VOICE_INPUT_ERROR, message, details)


def asr_error(message: str, details: Optional[Dict] = None) -> AppError:
    """创建 ASR 错误"""
    return AppError(ErrorCode.ASR_ERROR, message, details)


def semantic_parse_error(message: str, details: Optional[Dict] = None) -> AppError:
    """创建语义解析错误"""
    return AppError(ErrorCode.SEMANTIC_PARSE_ERROR, message, details)


def product_not_found_error(query: str) -> AppError:
    """创建商品未找到错误"""
    return AppError(
        ErrorCode.PRODUCT_NOT_FOUND,
        f"Product not found for query: {query}",
        {"query": query}
    )


def session_not_found_error(session_id: str) -> AppError:
    """创建会话未找到错误"""
    return AppError(
        ErrorCode.SESSION_NOT_FOUND,
        f"Session not found: {session_id}",
        {"session_id": session_id}
    )


def llm_error(message: str, details: Optional[Dict] = None) -> AppError:
    """创建 LLM 错误"""
    return AppError(ErrorCode.LLM_ERROR, message, details)
