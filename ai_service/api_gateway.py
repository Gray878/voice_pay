"""
API Gateway - AI 服务 API 网关
提供 RESTful API 端点，连接 AI 语义层和 Web3 执行层
Requirements: 13.1, 13.2, 13.3, 13.4
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from typing import Dict, Any, Optional
import requests
from dataclasses import dataclass, asdict

# 可选导入音频模块
try:
    from voice_input import VoiceInputModule
    VOICE_INPUT_AVAILABLE = True
except ImportError:
    VOICE_INPUT_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("Voice input module not available (missing audio dependencies)")

from asr_engine import ASREngine
from semantic_parser import SemanticParser
from knowledge_base import KnowledgeBase
from session_manager import SessionManager
from config import Config

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# 初始化服务
config = Config()
voice_input = VoiceInputModule() if VOICE_INPUT_AVAILABLE else None

# ASR Engine 可选（需要 whisper）
try:
    asr_engine = ASREngine()
    ASR_AVAILABLE = True
except RuntimeError:
    asr_engine = None
    ASR_AVAILABLE = False
    logger.warning("ASR Engine not available (missing whisper dependencies)")

semantic_parser = SemanticParser()
knowledge_base = KnowledgeBase()
session_manager = SessionManager()

# Web3 服务 URL
WEB3_SERVICE_URL = config.web3_service_url or "http://localhost:3001"


@dataclass
class APIResponse:
    """统一 API 响应格式"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    session_id: Optional[str] = None


def create_response(success: bool, data: Any = None, error: str = None, session_id: str = None) -> Dict:
    """创建标准化响应"""
    response = APIResponse(success=success, data=data, error=error, session_id=session_id)
    return asdict(response)


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({'status': 'healthy', 'service': 'ai-service'})


@app.route('/voice/start-recording', methods=['POST'])
def start_recording():
    """开始录音"""
    try:
        data = request.json or {}
        session_id = data.get('session_id')
        
        if not session_id:
            session_id = session_manager.create_session()
        
        voice_input.start_recording()
        
        return jsonify(create_response(
            success=True,
            data={'message': '开始录音'},
            session_id=session_id
        ))
    except Exception as e:
        logger.error(f"开始录音失败: {e}")
        return jsonify(create_response(success=False, error=str(e))), 500


@app.route('/voice/stop-recording', methods=['POST'])
def stop_recording():
    """停止录音并返回音频数据"""
    try:
        audio_data = voice_input.stop_recording()
        
        return jsonify(create_response(
            success=True,
            data={
                'audio_length': len(audio_data),
                'sample_rate': voice_input.sample_rate
            }
        ))
    except Exception as e:
        logger.error(f"停止录音失败: {e}")
        return jsonify(create_response(success=False, error=str(e))), 500


@app.route('/voice/transcribe', methods=['POST'])
def transcribe_audio():
    """语音转文字"""
    try:
        data = request.json or {}
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify(create_response(success=False, error='缺少 session_id')), 400
        
        # 获取录音数据
        audio_data = voice_input.get_audio_buffer()
        
        if audio_data is None or len(audio_data) == 0:
            return jsonify(create_response(success=False, error='没有音频数据')), 400
        
        # ASR 转录
        asr_result = asr_engine.transcribe(audio_data)
        
        # 更新会话上下文
        session_manager.update_context(session_id, {
            'last_transcription': asr_result.text,
            'confidence': asr_result.confidence
        })
        
        return jsonify(create_response(
            success=True,
            data={
                'text': asr_result.text,
                'confidence': asr_result.confidence,
                'language': asr_result.language
            },
            session_id=session_id
        ))
    except Exception as e:
        logger.error(f"语音转录失败: {e}")
        return jsonify(create_response(success=False, error=str(e))), 500


@app.route('/semantic/parse', methods=['POST'])
def parse_intent():
    """语义解析"""
    try:
        data = request.json or {}
        text = data.get('text')
        session_id = data.get('session_id')
        
        if not text:
            return jsonify(create_response(success=False, error='缺少 text 参数')), 400
        
        if not session_id:
            session_id = session_manager.create_session()
        
        # 获取会话上下文
        session = session_manager.get_session(session_id)
        context = session.get('context', {}) if session else {}
        
        # 语义解析
        parsed_intent = semantic_parser.parse(text, context)
        
        # 更新会话
        session_manager.update_context(session_id, {
            'last_intent': parsed_intent.intent_type.value,
            'entities': parsed_intent.entities,
            'conversation_history': context.get('conversation_history', []) + [text]
        })
        
        return jsonify(create_response(
            success=True,
            data={
                'intent': parsed_intent.intent_type.value,
                'entities': parsed_intent.entities,
                'confidence': parsed_intent.confidence
            },
            session_id=session_id
        ))
    except Exception as e:
        logger.error(f"语义解析失败: {e}")
        return jsonify(create_response(success=False, error=str(e))), 500


@app.route('/knowledge/search', methods=['POST'])
def search_products():
    """商品搜索"""
    try:
        data = request.json or {}
        query = data.get('query')
        session_id = data.get('session_id')
        filters = data.get('filters', {})
        top_k = data.get('top_k', 5)
        
        if not query:
            return jsonify(create_response(success=False, error='缺少 query 参数')), 400
        
        # 搜索商品
        results = knowledge_base.search(query, filters=filters, top_k=top_k)
        
        # 更新会话
        if session_id:
            session_manager.update_context(session_id, {
                'last_search_query': query,
                'search_results': [r['id'] for r in results]
            })
        
        return jsonify(create_response(
            success=True,
            data={'products': results},
            session_id=session_id
        ))
    except Exception as e:
        logger.error(f"商品搜索失败: {e}")
        return jsonify(create_response(success=False, error=str(e))), 500


@app.route('/knowledge/product/<product_id>', methods=['GET'])
def get_product(product_id: str):
    """获取商品详情"""
    try:
        product = knowledge_base.get_by_id(product_id)
        
        if not product:
            return jsonify(create_response(success=False, error='商品不存在')), 404
        
        return jsonify(create_response(success=True, data=product))
    except Exception as e:
        logger.error(f"获取商品失败: {e}")
        return jsonify(create_response(success=False, error=str(e))), 500


@app.route('/payment/initiate', methods=['POST'])
def initiate_payment():
    """发起支付流程（调用 Web3 服务）"""
    try:
        data = request.json or {}
        session_id = data.get('session_id')
        product_id = data.get('product_id')
        
        if not product_id:
            return jsonify(create_response(success=False, error='缺少 product_id')), 400
        
        # 获取商品信息
        product = knowledge_base.get_by_id(product_id)
        if not product:
            return jsonify(create_response(success=False, error='商品不存在')), 404
        
        # 构造支付请求
        payment_request = {
            'productId': product_id,
            'productName': product['name'],
            'amount': str(product['price']),
            'recipientAddress': product['contract_address']
        }
        
        # 调用 Web3 服务
        response = requests.post(
            f"{WEB3_SERVICE_URL}/payment/start",
            json=payment_request,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            
            # 更新会话
            if session_id:
                session_manager.update_context(session_id, {
                    'payment_initiated': True,
                    'product_id': product_id,
                    'payment_amount': product['price']
                })
            
            return jsonify(create_response(
                success=True,
                data=result,
                session_id=session_id
            ))
        else:
            error_msg = response.json().get('error', '支付启动失败')
            return jsonify(create_response(success=False, error=error_msg)), response.status_code
            
    except requests.RequestException as e:
        logger.error(f"调用 Web3 服务失败: {e}")
        return jsonify(create_response(success=False, error='Web3 服务不可用')), 503
    except Exception as e:
        logger.error(f"发起支付失败: {e}")
        return jsonify(create_response(success=False, error=str(e))), 500


@app.route('/payment/confirm', methods=['POST'])
def confirm_payment():
    """确认支付（调用 Web3 服务）"""
    try:
        data = request.json or {}
        session_id = data.get('session_id')
        
        # 调用 Web3 服务
        response = requests.post(
            f"{WEB3_SERVICE_URL}/payment/confirm",
            json={},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            
            # 更新会话
            if session_id:
                session_manager.update_context(session_id, {
                    'payment_confirmed': True
                })
            
            return jsonify(create_response(
                success=True,
                data=result,
                session_id=session_id
            ))
        else:
            error_msg = response.json().get('error', '支付确认失败')
            return jsonify(create_response(success=False, error=error_msg)), response.status_code
            
    except requests.RequestException as e:
        logger.error(f"调用 Web3 服务失败: {e}")
        return jsonify(create_response(success=False, error='Web3 服务不可用')), 503
    except Exception as e:
        logger.error(f"确认支付失败: {e}")
        return jsonify(create_response(success=False, error=str(e))), 500


@app.route('/payment/cancel', methods=['POST'])
def cancel_payment():
    """取消支付（调用 Web3 服务）"""
    try:
        data = request.json or {}
        session_id = data.get('session_id')
        
        # 调用 Web3 服务
        response = requests.post(
            f"{WEB3_SERVICE_URL}/payment/cancel",
            json={},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            
            # 清理会话
            if session_id:
                session_manager.update_context(session_id, {
                    'payment_cancelled': True,
                    'payment_initiated': False
                })
            
            return jsonify(create_response(
                success=True,
                data=result,
                session_id=session_id
            ))
        else:
            error_msg = response.json().get('error', '取消支付失败')
            return jsonify(create_response(success=False, error=error_msg)), response.status_code
            
    except requests.RequestException as e:
        logger.error(f"调用 Web3 服务失败: {e}")
        return jsonify(create_response(success=False, error='Web3 服务不可用')), 503
    except Exception as e:
        logger.error(f"取消支付失败: {e}")
        return jsonify(create_response(success=False, error=str(e))), 500


@app.route('/session/create', methods=['POST'])
def create_session():
    """创建新会话"""
    try:
        session_id = session_manager.create_session()
        return jsonify(create_response(
            success=True,
            data={'session_id': session_id},
            session_id=session_id
        ))
    except Exception as e:
        logger.error(f"创建会话失败: {e}")
        return jsonify(create_response(success=False, error=str(e))), 500


@app.route('/session/<session_id>', methods=['GET'])
def get_session(session_id: str):
    """获取会话信息"""
    try:
        session = session_manager.get_session(session_id)
        
        if not session:
            return jsonify(create_response(success=False, error='会话不存在')), 404
        
        return jsonify(create_response(success=True, data=session))
    except Exception as e:
        logger.error(f"获取会话失败: {e}")
        return jsonify(create_response(success=False, error=str(e))), 500


@app.errorhandler(404)
def not_found(error):
    """404 错误处理"""
    return jsonify(create_response(success=False, error='接口不存在')), 404


@app.errorhandler(500)
def internal_error(error):
    """500 错误处理"""
    logger.error(f"服务器内部错误: {error}")
    return jsonify(create_response(success=False, error='服务器内部错误')), 500


if __name__ == '__main__':
    port = config.ai_service_port or 5000
    logger.info(f"AI Service 启动在端口 {port}")
    app.run(host='0.0.0.0', port=port, debug=config.debug)
