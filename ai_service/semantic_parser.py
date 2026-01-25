"""
语义解析器模块 (Semantic Parser)
负责理解用户意图，提取关键实体和参数
"""

import logging
import time
import threading
from dataclasses import dataclass
from typing import Dict, List, Optional, Any
from enum import Enum

from langchain.chains import ConversationChain
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

from config import settings
from llm_adapter import llm_adapter

logger = logging.getLogger(__name__)


class IntentType(Enum):
    """用户意图类型"""
    QUERY = "query"           # 查询商品
    PURCHASE = "purchase"     # 购买商品
    CONFIRM = "confirm"       # 确认交易
    CANCEL = "cancel"         # 取消交易
    HELP = "help"             # 请求帮助
    HISTORY = "history"       # 查询历史


@dataclass
class ParsedIntent:
    """
    解析后的用户意图
    
    Attributes:
        intent: 意图类型
        entities: 提取的实体字典（商品类型、属性、价格范围等）
        confidence: 置信度分数 (0-1)
        missing_info: 缺失的必要信息列表
    """
    intent: IntentType
    entities: Dict[str, Any]
    confidence: float
    missing_info: List[str]


class EntityExtraction(BaseModel):
    """实体提取结果的 Pydantic 模型"""
    product_type: Optional[str] = Field(None, description="商品类型（NFT/Token）")
    category: Optional[str] = Field(None, description="商品类别（如：音乐会、游戏、艺术品）")
    use_case: Optional[str] = Field(None, description="使用场景描述")
    price_min: Optional[float] = Field(None, description="最低价格")
    price_max: Optional[float] = Field(None, description="最高价格")
    currency: Optional[str] = Field(None, description="货币类型（如：MATIC、ETH）")
    chain: Optional[str] = Field(None, description="区块链网络（如：Polygon、Ethereum）")
    attributes: Optional[Dict[str, Any]] = Field(None, description="其他属性")


class SemanticParser:
    """
    语义解析器
    
    职责：
    - 理解用户意图，提取关键实体
    - 使用 LangChain ConversationChain 维护多轮对话
    - 支持指代消解（这个、那个、第一个等）
    - 识别缺失信息并生成澄清问题
    
    Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
    """
    
    _llm_lock = threading.Lock()
    _last_call_ts = 0.0
    _min_interval_seconds = 1.2

    # Few-shot learning 示例
    FEW_SHOT_EXAMPLES = """
示例 1:
用户: "帮我买一个能进元宇宙音乐派对的 NFT"
意图: QUERY
实体: {
  "product_type": "NFT",
  "use_case": "元宇宙音乐派对",
  "category": "活动门票"
}

示例 2:
用户: "我想要一个价格在 100 MATIC 以下的游戏道具"
意图: QUERY
实体: {
  "product_type": "NFT",
  "category": "游戏道具",
  "price_max": 100,
  "currency": "MATIC"
}

示例 3:
用户: "买第一个"
意图: PURCHASE
实体: {
  "reference": "first",
  "reference_type": "ordinal"
}

示例 4:
用户: "确认购买"
意图: CONFIRM
实体: {}

示例 5:
用户: "取消"
意图: CANCEL
实体: {}

示例 6:
用户: "我之前买过什么"
意图: HISTORY
实体: {}
"""
    
    # 系统提示模板
    SYSTEM_PROMPT_TEMPLATE = """你是一个 Web3 语音购物助手。用户会用自然语言描述想购买的 NFT 或 Token。

你的任务是：
1. 识别用户意图（QUERY/PURCHASE/CONFIRM/CANCEL/HELP/HISTORY）
2. 提取商品特征（类型、属性、价格范围、区块链网络）
3. 如果信息不完整，识别缺失的必要信息

{few_shot_examples}

当前对话历史：
{history}

用户输入: {input}

请分析用户意图并提取实体。以 JSON 格式返回结果：
{{
  "intent": "意图类型",
  "entities": {{实体字典}},
  "confidence": 置信度(0-1),
  "missing_info": [缺失信息列表]
}}
"""
    
    def __init__(
        self,
        llm_model: str = None,
        temperature: float = 0.3,
        max_history: int = 5
    ):
        """
        初始化语义解析器
        
        Args:
            llm_model: LLM 模型名称，默认使用配置中的模型
            temperature: 生成温度，默认 0.3（较低温度保证稳定性）
            max_history: 保留的最大对话轮数，默认 5
        """
        if llm_model is None:
            llm_model = settings.llm_provider
        
        self.llm_model = llm_model
        self.temperature = temperature
        self.max_history = max_history
        
        # 使用 LLM 适配器（不使用 langchain）
        self.llm_adapter = llm_adapter
        
        # 简化的对话历史（不使用 langchain memory）
        self.conversation_history: List[Dict[str, str]] = []
        
        logger.info(f"SemanticParser 初始化完成，使用模型: {llm_model}")
    
    def parse(
        self,
        text: str,
        session_context: Optional[Dict] = None
    ) -> ParsedIntent:
        """
        解析用户输入文本
        
        Args:
            text: ASR 转录的文本
            session_context: 会话上下文（历史对话、已选商品等）
        
        Returns:
            ParsedIntent: 解析后的意图对象
        
        Requirements: 2.1, 2.2, 2.5
        """
        if not text or not text.strip():
            raise ValueError("输入文本为空")
        
        logger.info(f"开始解析用户输入: '{text}'")
        
        try:
            # 构造提示
            conversation_text = ""
            if session_context and 'conversation_history' in session_context:
                # 转换历史格式
                history = session_context['conversation_history']
                for msg in history[-self.max_history*2:]:
                    role = "User" if msg.get('role') == 'user' else "Assistant"
                    conversation_text += f"{role}: {msg.get('content')}\n"

            # 填充 System Prompt
            prompt = self.SYSTEM_PROMPT_TEMPLATE.format(
                few_shot_examples=self.FEW_SHOT_EXAMPLES,
                history=conversation_text,
                input=text
            )

            messages = [{"role": "user", "content": prompt}]
            response = None
            last_error = None
            for attempt in range(3):
                try:
                    with self._llm_lock:
                        now = time.time()
                        wait_seconds = self._min_interval_seconds - (now - self._last_call_ts)
                        if wait_seconds > 0:
                            time.sleep(wait_seconds)
                        response = self.llm_adapter.chat_completion(
                            messages=messages,
                            temperature=self.temperature
                        )
                        self._last_call_ts = time.time()
                    break
                except Exception as e:
                    last_error = e
                    logger.warning(f"LLM 调用失败，尝试 {attempt + 1}/3: {e}")
                    time.sleep(0.8 * (attempt + 1))
            if response is None:
                raise RuntimeError(f"LLM 调用失败: {last_error}")
            
            # 解析 LLM 响应
            parsed_result = self._parse_llm_response(response)
            
            # 如果是引用类型（如"第一个"），解析引用
            if 'reference' in parsed_result.get('entities', {}):
                resolved_entity = self.resolve_reference(
                    text,
                    session_context or {}
                )
                if resolved_entity:
                    parsed_result['entities'].update(resolved_entity)

            if self.is_list_all_request(text, parsed_result):
                parsed_result["intent"] = "query"
                entities = parsed_result.get("entities") or {}
                entities["list_all_products"] = True
                parsed_result["entities"] = entities
                parsed_result["missing_info"] = []
                parsed_result["confidence"] = max(parsed_result.get("confidence", 0.0), 0.8)
            
            # 创建 ParsedIntent 对象
            intent = ParsedIntent(
                intent=IntentType(parsed_result['intent'].lower()),
                entities=parsed_result.get('entities', {}),
                confidence=parsed_result.get('confidence', 0.8),
                missing_info=parsed_result.get('missing_info', [])
            )
            
            logger.info(
                f"解析完成: intent={intent.intent.value}, "
                f"confidence={intent.confidence:.3f}, "
                f"entities={len(intent.entities)}"
            )
            
            return intent
            
        except Exception as e:
            logger.error(f"解析失败: {e}", exc_info=True)
            return self._fallback_parse(text)

    def _fallback_parse(self, text: str) -> ParsedIntent:
        text_lower = text.lower()
        entities: Dict[str, Any] = {}
        intent = IntentType.HELP
        confidence = 0.4

        if self.is_list_all_request(text):
            intent = IntentType.QUERY
            confidence = 0.75
            entities["list_all_products"] = True

        if any(word in text_lower for word in ['买', '购买', '想要', '下单', '购买nft', '购买 nft']):
            intent = IntentType.QUERY
            confidence = 0.6
        elif any(word in text_lower for word in ['找', '搜索', '看看', '有没有']):
            intent = IntentType.QUERY
            confidence = 0.55

        if 'nft' in text_lower:
            entities['product_type'] = 'NFT'
        if 'token' in text_lower:
            entities['product_type'] = 'Token'

        missing_info = []
        if intent == IntentType.QUERY and not entities:
            missing_info = ['商品名称或类型']

        return ParsedIntent(
            intent=intent,
            entities=entities,
            confidence=confidence,
            missing_info=missing_info
        )

    def is_discovery_request(
        self,
        text: str,
        parsed_intent: Optional[ParsedIntent] = None
    ) -> bool:
        text_lower = text.lower()
        discovery_keywords = [
            "不知道买什么",
            "不知道买啥",
            "随便看看",
            "随便选",
            "有什么推荐",
            "推荐一下",
            "推荐点",
            "看下推荐",
            "看看推荐",
            "热门有什么",
            "有什么热门",
            "不知道选什么",
            "帮我选",
        ]
        if any(keyword in text_lower for keyword in discovery_keywords):
            return True

        if not parsed_intent:
            return False

        if parsed_intent.intent not in {IntentType.QUERY, IntentType.PURCHASE}:
            return False

        if parsed_intent.entities:
            return False

        missing_text = "".join(parsed_intent.missing_info or [])
        if any(keyword in missing_text for keyword in ["商品", "名称", "类型", "关键词", "品类"]):
            return True

        return False

    def is_list_all_request(
        self,
        text: str,
        parsed_intent: Optional[Dict[str, Any]] = None
    ) -> bool:
        text_lower = text.lower()
        list_all_keywords = [
            "列出所有商品",
            "列出全部商品",
            "列出所有",
            "列出全部",
            "展示全部商品",
            "展示所有商品",
            "全部商品",
            "所有商品",
            "所有的商品",
            "把所有商品",
            "把全部商品",
            "全部列出",
            "全部列出来",
            "列出来所有",
            "列出来全部",
            "全都有哪些",
            "有哪些商品",
            "所有nft",
            "全部nft",
            "全部token",
            "所有token"
        ]
        if any(keyword in text_lower for keyword in list_all_keywords):
            return True

        if not parsed_intent:
            return False

        entities = parsed_intent.get("entities") if isinstance(parsed_intent, dict) else None
        if entities and entities.get("list_all_products"):
            return True

        return False
    
    def extract_entities(self, text: str) -> Dict[str, Any]:
        """
        提取命名实体（商品类型、属性、价格等）
        
        使用 LLM Function Calling 能力进行结构化提取
        
        Args:
            text: 用户输入文本
        
        Returns:
            提取的实体字典
        
        Requirements: 2.1
        """
        logger.info(f"提取实体: '{text}'")
        
        try:
            # 创建输出解析器
            parser = PydanticOutputParser(pydantic_object=EntityExtraction)
            
            # 构造提示
            prompt_text = f"""从以下用户输入中提取商品相关实体：

用户输入: {text}

{parser.get_format_instructions()}
"""
            
            # 调用 LLM
            response = self.llm.predict(prompt_text)
            
            # 解析结果
            entity_obj = parser.parse(response)
            
            # 转换为字典，过滤 None 值
            entities = {
                k: v for k, v in entity_obj.dict().items()
                if v is not None
            }
            
            logger.info(f"提取到 {len(entities)} 个实体")
            return entities
            
        except Exception as e:
            logger.error(f"实体提取失败: {e}")
            return {}
    
    def resolve_reference(
        self,
        text: str,
        context: Dict
    ) -> Optional[Dict[str, Any]]:
        """
        解析指代词（这个、那个、第一个等）
        
        Args:
            text: 用户输入文本
            context: 会话上下文（包含 selected_products）
        
        Returns:
            解析后的实体字典，如果无法解析返回 None
        
        Requirements: 2.6
        """
        logger.info(f"解析指代: '{text}'")
        
        # 获取已选商品列表
        selected_products = context.get('selected_products', [])
        
        if not selected_products:
            logger.warning("上下文中没有可引用的商品")
            return None
        
        # 检测序号引用
        ordinal_map = {
            '第一个': 0, '第1个': 0, '1': 0, 'first': 0,
            '第二个': 1, '第2个': 1, '2': 1, 'second': 1,
            '第三个': 2, '第3个': 2, '3': 2, 'third': 2,
            '第四个': 3, '第4个': 3, '4': 3, 'fourth': 3,
            '第五个': 4, '第5个': 4, '5': 4, 'fifth': 4,
        }
        
        text_lower = text.lower()
        
        for keyword, index in ordinal_map.items():
            if keyword in text_lower:
                if index < len(selected_products):
                    product = selected_products[index]
                    logger.info(f"解析序号引用: {keyword} -> 商品 {product.get('id', 'unknown')}")
                    return {
                        'product_id': product.get('id'),
                        'product_name': product.get('name'),
                        'reference_resolved': True
                    }
                else:
                    logger.warning(f"序号 {keyword} 超出商品列表范围")
                    return None
        
        # 检测指示代词
        demonstrative_keywords = ['这个', '那个', 'this', 'that', '它']
        for keyword in demonstrative_keywords:
            if keyword in text_lower:
                # 默认引用最后一个商品
                if selected_products:
                    product = selected_products[-1]
                    logger.info(f"解析指示代词: {keyword} -> 最后一个商品 {product.get('id', 'unknown')}")
                    return {
                        'product_id': product.get('id'),
                        'product_name': product.get('name'),
                        'reference_resolved': True
                    }
        
        logger.info("未检测到有效的指代词")
        return None
    
    def _update_memory_from_context(self, conversation_history: List[Dict]) -> None:
        """
        从会话上下文更新对话记忆
        
        Args:
            conversation_history: 对话历史列表
        """
        # 清空现有记忆
        self.memory.clear()
        
        # 只保留最近 max_history 轮对话
        recent_history = conversation_history[-self.max_history * 2:]  # 每轮包含 user 和 assistant
        
        for message in recent_history:
            role = message.get('role')
            content = message.get('content')
            
            if role == 'user':
                self.memory.chat_memory.add_user_message(content)
            elif role == 'assistant':
                self.memory.chat_memory.add_ai_message(content)
    
    def _parse_llm_response(self, response: str) -> Dict[str, Any]:
        """
        解析 LLM 的 JSON 响应
        
        Args:
            response: LLM 返回的文本
        
        Returns:
            解析后的字典
        """
        import json
        import re
        
        try:
            # 尝试直接解析 JSON
            return json.loads(response)
        except json.JSONDecodeError:
            # 如果失败，尝试提取 JSON 代码块
            json_match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(1))
            
            # 如果还是失败，尝试提取花括号内容
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
            
            # 无法解析，返回默认结构
            logger.warning(f"无法解析 LLM 响应: {response}")
            return {
                'intent': 'help',
                'entities': {},
                'confidence': 0.0,
                'missing_info': ['无法解析响应']
            }
    
    def clear_memory(self) -> None:
        """清空对话记忆"""
        self.memory.clear()
        logger.info("对话记忆已清空")
    
    def get_conversation_summary(self) -> str:
        """
        获取对话摘要
        
        Returns:
            对话摘要文本
        """
        messages = self.memory.chat_memory.messages
        if not messages:
            return "暂无对话历史"
        
        summary_parts = []
        for msg in messages[-10:]:  # 最近 10 条消息
            role = "用户" if msg.type == "human" else "助手"
            summary_parts.append(f"{role}: {msg.content[:50]}...")
        
        return "\n".join(summary_parts)
