"""
LLM Adapter - 大语言模型适配器
支持 OpenAI 和智谱 AI
"""

from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod
import openai

# 可选导入智谱 AI
try:
    from zhipuai import ZhipuAI
    ZHIPU_AVAILABLE = True
except ImportError:
    ZHIPU_AVAILABLE = False
    ZhipuAI = None

from config import settings


class LLMAdapter(ABC):
    """LLM 适配器基类"""
    
    @abstractmethod
    def chat_completion(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """聊天补全"""
        pass
    
    @abstractmethod
    def generate_embedding(self, text: str) -> List[float]:
        """生成文本嵌入向量"""
        pass


class OpenAIAdapter(LLMAdapter):
    """OpenAI 适配器"""
    
    def __init__(self, api_key: str, model: str, embedding_model: str):
        self.client = openai.OpenAI(api_key=api_key)
        self.model = model
        self.embedding_model = embedding_model
    
    def chat_completion(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """OpenAI 聊天补全"""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            **kwargs
        )
        return response.choices[0].message.content
    
    def generate_embedding(self, text: str) -> List[float]:
        """OpenAI 文本嵌入"""
        response = self.client.embeddings.create(
            model=self.embedding_model,
            input=text
        )
        return response.data[0].embedding


class ZhipuAdapter(LLMAdapter):
    """智谱 AI 适配器"""
    
    def __init__(self, api_key: str, model: str, embedding_model: str):
        if not ZHIPU_AVAILABLE:
            raise ImportError(
                "智谱 AI SDK 未安装。请运行: pip install zhipuai"
            )
        self.client = ZhipuAI(api_key=api_key)
        self.model = model
        self.embedding_model = embedding_model
    
    def chat_completion(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """智谱 AI 聊天补全"""
        # 智谱 AI 的参数映射
        zhipu_kwargs = {
            'model': self.model,
            'messages': messages
        }
        
        # 映射常用参数
        if 'temperature' in kwargs:
            zhipu_kwargs['temperature'] = kwargs['temperature']
        if 'max_tokens' in kwargs:
            zhipu_kwargs['max_tokens'] = kwargs['max_tokens']
        if 'top_p' in kwargs:
            zhipu_kwargs['top_p'] = kwargs['top_p']
        
        response = self.client.chat.completions.create(**zhipu_kwargs)
        return response.choices[0].message.content
    
    def generate_embedding(self, text: str) -> List[float]:
        """智谱 AI 文本嵌入"""
        response = self.client.embeddings.create(
            model=self.embedding_model,
            input=text
        )
        return response.data[0].embedding


def get_llm_adapter() -> LLMAdapter:
    """获取 LLM 适配器实例"""
    provider = settings.llm_provider.lower()
    
    if provider == "openai":
        if not settings.openai_api_key:
            raise ValueError("OpenAI API Key 未配置")
        return OpenAIAdapter(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            embedding_model=settings.openai_embedding_model
        )
    
    elif provider == "zhipu":
        if not ZHIPU_AVAILABLE:
            raise ImportError(
                "智谱 AI SDK 未安装。请运行: pip install zhipuai\n"
                "或者切换为 OpenAI: 在 .env 中设置 LLM_PROVIDER=openai"
            )
        if not settings.zhipu_api_key:
            raise ValueError("智谱 AI API Key 未配置")
        return ZhipuAdapter(
            api_key=settings.zhipu_api_key,
            model=settings.zhipu_model,
            embedding_model=settings.zhipu_embedding_model
        )
    
    else:
        raise ValueError(f"不支持的 LLM Provider: {provider}")


# 全局 LLM 实例
llm_adapter = get_llm_adapter()
