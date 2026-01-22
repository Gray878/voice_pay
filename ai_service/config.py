"""
配置管理模块
从环境变量加载配置
"""

import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """应用配置"""
    
    # LLM Provider 选择
    llm_provider: str = Field(default="openai", env="LLM_PROVIDER")  # openai 或 zhipu
    
    # OpenAI 配置
    openai_api_key: Optional[str] = Field(default=None, env="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4", env="OPENAI_MODEL")
    openai_embedding_model: str = Field(
        default="text-embedding-3-large",
        env="OPENAI_EMBEDDING_MODEL"
    )
    
    # 智谱 AI 配置
    zhipu_api_key: Optional[str] = Field(default=None, env="ZHIPU_API_KEY")
    zhipu_model: str = Field(default="glm-4", env="ZHIPU_MODEL")
    zhipu_embedding_model: str = Field(default="embedding-2", env="ZHIPU_EMBEDDING_MODEL")
    
    # Whisper 配置
    whisper_model: str = Field(default="whisper-large-v3", env="WHISPER_MODEL")
    whisper_device: str = Field(default="cpu", env="WHISPER_DEVICE")
    
    # Pinecone 配置
    pinecone_api_key: str = Field(..., env="PINECONE_API_KEY")
    pinecone_index_name: str = Field(
        default="voice-to-pay-products",
        env="PINECONE_INDEX_NAME"
    )
    
    # PostgreSQL 配置
    postgres_host: str = Field(default="localhost", env="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, env="POSTGRES_PORT")
    postgres_db: str = Field(default="voice_to_pay", env="POSTGRES_DB")
    postgres_user: str = Field(default="postgres", env="POSTGRES_USER")
    postgres_password: str = Field(..., env="POSTGRES_PASSWORD")
    
    # Redis 配置
    redis_host: str = Field(default="localhost", env="REDIS_HOST")
    redis_port: int = Field(default=6379, env="REDIS_PORT")
    redis_db: int = Field(default=0, env="REDIS_DB")
    redis_password: Optional[str] = Field(default=None, env="REDIS_PASSWORD")
    
    # 服务配置
    ai_service_host: str = Field(default="localhost", env="AI_SERVICE_HOST")
    ai_service_port: int = Field(default=8000, env="AI_SERVICE_PORT")
    web3_service_url: str = Field(default="http://localhost:3001", env="WEB3_SERVICE_URL")
    debug: bool = Field(default=False, env="DEBUG")
    
    # 会话配置
    session_ttl: int = Field(default=600, env="SESSION_TTL")  # 10 分钟
    
    # 音频配置
    audio_sample_rate: int = Field(default=16000, env="AUDIO_SAMPLE_RATE")
    silence_threshold: float = Field(default=2.0, env="SILENCE_THRESHOLD")
    
    # 知识库配置
    search_top_k: int = Field(default=5, env="SEARCH_TOP_K")
    
    # 日志配置
    log_level: str = Field(default="info", env="LOG_LEVEL")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
    
    @property
    def postgres_url(self) -> str:
        """获取 PostgreSQL 连接 URL"""
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
    
    @property
    def redis_url(self) -> str:
        """获取 Redis 连接 URL"""
        if self.redis_password:
            return (
                f"redis://:{self.redis_password}@{self.redis_host}:"
                f"{self.redis_port}/{self.redis_db}"
            )
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"


# 全局配置实例
settings = Settings()

# 简化别名
Config = Settings
