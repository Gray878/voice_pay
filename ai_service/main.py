"""
AI Service 主入口
FastAPI 服务器
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
import uvicorn
import uuid
from config import settings
from voice_feedback import voice_feedback, FeedbackType
from error_handler import AppError, ErrorResponse
from logger import setup_logging, set_session_id, clear_session_id, get_logger

# 配置日志系统
setup_logging(
    log_level=settings.log_level.upper(),
    log_dir="logs",
    enable_json=False
)

logger = get_logger(__name__)

from semantic_parser import SemanticParser, IntentType
from knowledge_base import KnowledgeBase
from session_manager import SessionManager

# 初始化核心服务
try:
    semantic_parser = SemanticParser()
    knowledge_base = KnowledgeBase()
    session_manager = SessionManager()
    logger.info("核心服务初始化成功")
except Exception as e:
    logger.error(f"核心服务初始化失败: {e}", exc_info=True)
    # 不中断启动，但服务可能不可用

# 创建 FastAPI 应用
app = FastAPI(
    title="Voice-to-Pay AI Service",
    description="AI 语义层服务 - 语音识别、语义理解和商品知识库查询",
    version="0.1.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 请求 ID 中间件
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """为每个请求添加唯一 ID"""
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    logger.info(
        f"Request started: {request.method} {request.url.path}",
        extra={"request_id": request_id}
    )
    
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    
    logger.info(
        f"Request completed: {response.status_code}",
        extra={"request_id": request_id}
    )
    
    return response


# 全局异常处理
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    """处理应用错误"""
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=400,
        content=ErrorResponse.create(exc, request_id)
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """处理通用异常"""
    request_id = getattr(request.state, "request_id", None)
    logger.error(
        f"Unhandled exception: {str(exc)}",
        exc_info=True,
        extra={"request_id": request_id}
    )
    return JSONResponse(
        status_code=500,
        content=ErrorResponse.from_exception(exc, request_id)
    )


# 请求模型
class FeedbackRequest(BaseModel):
    feedback_type: str
    template_key: str
    params: Optional[Dict[str, Any]] = {}


class ProductInfoRequest(BaseModel):
    product: Dict[str, Any]


class TransactionSummaryRequest(BaseModel):
    product_name: str
    price: str
    wallet_name: str
    gas_fee: str
    network: str


class ErrorMessageRequest(BaseModel):
    error_message: str


class ParseRequest(BaseModel):
    text: str
    session_id: Optional[str] = None


class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5


@app.get("/")
async def root():
    """健康检查端点"""
    return {
        "service": "Voice-to-Pay AI Service",
        "status": "running",
        "version": "0.1.0"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    logger.debug("Health check called")
    return {"status": "healthy"}


# 语音反馈 API
@app.post("/feedback/generate")
async def generate_feedback(request: FeedbackRequest, req: Request):
    """生成语音反馈消息"""
    try:
        feedback_type = FeedbackType(request.feedback_type)
        message = voice_feedback.generate_feedback(
            feedback_type,
            request.template_key,
            **request.params
        )
        
        logger.info(
            f"Generated feedback: {request.template_key}",
            extra={"request_id": req.state.request_id}
        )
        
        return {"success": True, "message": message}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"无效的反馈类型: {request.feedback_type}")
    except Exception as e:
        logger.error(f"Feedback generation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feedback/product-info")
async def format_product_info(request: ProductInfoRequest):
    """格式化商品信息"""
    try:
        message = voice_feedback.format_product_info(request.product)
        return {"success": True, "message": message}
    except Exception as e:
        logger.error(f"Product info formatting failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feedback/transaction-summary")
async def format_transaction_summary(request: TransactionSummaryRequest):
    """格式化交易摘要"""
    try:
        message = voice_feedback.format_transaction_summary(
            request.product_name,
            request.price,
            request.wallet_name,
            request.gas_fee,
            request.network
        )
        return {"success": True, "message": message}
    except Exception as e:
        logger.error(f"Transaction summary formatting failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feedback/error-message")
async def format_error_message(request: ErrorMessageRequest):
    """格式化错误消息"""
    try:
        error = Exception(request.error_message)
        message = voice_feedback.format_error_message(error)
        return {"success": True, "message": message}
    except Exception as e:
        logger.error(f"Error message formatting failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# 语义解析 API（前端集成）
@app.post("/parse")
async def parse_text(request: ParseRequest, req: Request):
    """解析用户输入文本"""
    try:
        logger.info(f"Parsing text: {request.text[:50]}...")
        
        session_context = {}
        session_id = request.session_id
        session = None

        try:
            if session_id:
                session = session_manager.get_session(session_id)
                if session is None:
                    session = session_manager.create_session(user_id=session_id)
                    session_id = session.session_id
            else:
                session = session_manager.create_session(user_id="anonymous")
                session_id = session.session_id

            if session:
                session_context = {
                    "conversation_history": session.conversation_history,
                    "selected_products": session.selected_products
                }
        except Exception as e:
            logger.warning(f"获取会话失败: {e}")

        # 调用语义解析
        parsed_intent = semantic_parser.parse(
            text=request.text,
            session_context=session_context
        )

        logger.info(
            f"Parse result: intent={parsed_intent.intent.value}, "
            f"confidence={parsed_intent.confidence:.3f}, "
            f"entities={parsed_intent.entities}, "
            f"missing_info={parsed_intent.missing_info}"
        )
        
        # 记录到会话历史
        try:
            session_manager.add_conversation_message(session_id, "user", request.text)
            session_manager.add_conversation_message(
                session_id, 
                "assistant", 
                f"Parsed intent: {parsed_intent.intent.value}",
                metadata={
                    "intent": parsed_intent.intent.value,
                    "confidence": parsed_intent.confidence
                }
            )
        except Exception as e:
            logger.warning(f"更新会话历史失败: {e}")

        action = None
        discovery_filters = None
        text_response = None
        default_query = None

        if semantic_parser.is_discovery_request(request.text, parsed_intent):
            action = "show_discovery"
            discovery_filters = ["热门", "新上架", "低价", "高成交"]
            text_response = "先给你热门推荐，想筛选价格或链可以告诉我"
            default_query = "热门"

        response_payload = {
            "success": True,
            "session_id": session_id,
            "intent": parsed_intent.intent.value,
            "entities": parsed_intent.entities,
            "confidence": parsed_intent.confidence,
            "missing_info": parsed_intent.missing_info,
            "action": action,
            "text_response": text_response,
            "discovery_filters": discovery_filters,
            "default_query": default_query
        }

        return response_payload
    except Exception as e:
        logger.error(f"Parse failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# 商品搜索 API（前端集成）
@app.post("/search")
async def search_products(request: SearchRequest, req: Request):
    """搜索商品"""
    try:
        logger.info(f"Searching products: {request.query}")
        
        # 模拟商品搜索（实际应调用 knowledge_base）
        # TODO: 集成真实的 knowledge_base
        mock_products = [
            {
                "id": "1",
                "name": "CryptoPunk #1234",
                "description": "稀有的 CryptoPunk NFT",
                "price": "0.5 ETH",
                "chain": "Polygon Mumbai",
                "contract_address": "0x1234567890123456789012345678901234567890",
                "image_url": "https://via.placeholder.com/300"
            },
            {
                "id": "2",
                "name": "Bored Ape #5678",
                "description": "无聊猿 NFT",
                "price": "0.3 ETH",
                "chain": "Polygon Mumbai",
                "contract_address": "0x2345678901234567890123456789012345678901",
                "image_url": "https://via.placeholder.com/300"
            },
            {
                "id": "3",
                "name": "Azuki #9012",
                "description": "Azuki NFT 系列",
                "price": "0.2 ETH",
                "chain": "Polygon Mumbai",
                "contract_address": "0x3456789012345678901234567890123456789012",
                "image_url": "https://via.placeholder.com/300"
            }
        ]
        
        return {
            "success": True,
            "products": mock_products[:request.top_k],
            "total": len(mock_products)
        }
    except Exception as e:
        logger.error(f"Search failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.ai_service_host,
        port=settings.ai_service_port,
        reload=settings.debug and os.name != "nt"
    )
