"""
配置模块测试
"""

import pytest
import os
from unittest.mock import patch


def test_config_loading_with_env_vars():
    """测试配置从环境变量加载"""
    # 设置测试环境变量
    test_env = {
        'OPENAI_API_KEY': 'test-key',
        'PINECONE_API_KEY': 'test-pinecone-key',
        'POSTGRES_PASSWORD': 'test-password',
        'API_SECRET_KEY': 'test-secret'
    }
    
    with patch.dict(os.environ, test_env, clear=False):
        # 重新导入配置以使用新的环境变量
        import importlib
        import config
        importlib.reload(config)
        
        settings = config.settings
        
        # 验证配置加载
        assert settings.openai_api_key == 'test-key'
        assert settings.pinecone_api_key == 'test-pinecone-key'
        assert settings.postgres_password == 'test-password'


def test_config_default_values():
    """测试配置默认值"""
    test_env = {
        'OPENAI_API_KEY': 'test-key',
        'PINECONE_API_KEY': 'test-pinecone-key',
        'POSTGRES_PASSWORD': 'test-password'
    }
    
    with patch.dict(os.environ, test_env, clear=False):
        import importlib
        import config
        importlib.reload(config)
        
        settings = config.settings
        
        # 验证默认值
        assert settings.openai_model == 'gpt-4'
        assert settings.whisper_model == 'whisper-large-v3'
        assert settings.postgres_host == 'localhost'
        assert settings.postgres_port == 5432
        assert settings.redis_port == 6379
        assert settings.session_ttl == 600


def test_postgres_url_generation():
    """测试 PostgreSQL URL 生成"""
    test_env = {
        'OPENAI_API_KEY': 'test-key',
        'PINECONE_API_KEY': 'test-pinecone-key',
        'POSTGRES_USER': 'testuser',
        'POSTGRES_PASSWORD': 'testpass',
        'POSTGRES_HOST': 'testhost',
        'POSTGRES_PORT': '5433',
        'POSTGRES_DB': 'testdb'
    }
    
    with patch.dict(os.environ, test_env, clear=False):
        import importlib
        import config
        importlib.reload(config)
        
        settings = config.settings
        
        expected_url = 'postgresql://testuser:testpass@testhost:5433/testdb'
        assert settings.postgres_url == expected_url


def test_redis_url_generation():
    """测试 Redis URL 生成"""
    test_env = {
        'OPENAI_API_KEY': 'test-key',
        'PINECONE_API_KEY': 'test-pinecone-key',
        'POSTGRES_PASSWORD': 'test-password',
        'REDIS_HOST': 'testhost',
        'REDIS_PORT': '6380',
        'REDIS_DB': '1'
    }
    
    with patch.dict(os.environ, test_env, clear=False):
        import importlib
        import config
        importlib.reload(config)
        
        settings = config.settings
        
        expected_url = 'redis://testhost:6380/1'
        assert settings.redis_url == expected_url
