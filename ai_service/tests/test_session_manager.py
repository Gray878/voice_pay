"""
SessionManager 单元测试
测试会话管理的核心功能
"""

import pytest
import json
import time
import os
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
import redis

# 设置测试环境变量
os.environ.setdefault("OPENAI_API_KEY", "test_key")
os.environ.setdefault("PINECONE_API_KEY", "test_key")
os.environ.setdefault("POSTGRES_PASSWORD", "test_password")

from session_manager import SessionManager, UserSession


@pytest.fixture
def mock_redis():
    """创建 Mock Redis 客户端"""
    mock_client = Mock(spec=redis.Redis)
    mock_client.data = {}  # 模拟内存存储
    mock_client.ttls = {}  # 模拟 TTL
    
    def setex(key, ttl, value):
        mock_client.data[key] = value
        mock_client.ttls[key] = ttl
        return True
    
    def get(key):
        return mock_client.data.get(key)
    
    def delete(key):
        if key in mock_client.data:
            del mock_client.data[key]
            if key in mock_client.ttls:
                del mock_client.ttls[key]
            return 1
        return 0
    
    def ttl(key):
        return mock_client.ttls.get(key, -1)
    
    def expire(key, seconds):
        if key in mock_client.data:
            mock_client.ttls[key] = seconds
            return True
        return False
    
    mock_client.setex = setex
    mock_client.get = get
    mock_client.delete = delete
    mock_client.ttl = ttl
    mock_client.expire = expire
    
    return mock_client


@pytest.fixture
def session_manager(mock_redis):
    """创建 SessionManager 实例"""
    return SessionManager(redis_client=mock_redis)


class TestSessionCreation:
    """测试会话创建功能"""
    
    def test_create_session_returns_valid_session(self, session_manager):
        """测试创建会话返回有效的 UserSession 对象"""
        user_id = "test_user_123"
        session = session_manager.create_session(user_id)
        
        assert isinstance(session, UserSession)
        assert session.user_id == user_id
        assert session.session_id is not None
        assert len(session.session_id) > 0
        assert session.conversation_history == []
        assert session.selected_products == []
        assert session.current_state == "IDLE"
    
    def test_create_session_generates_unique_ids(self, session_manager):
        """测试创建多个会话生成唯一 ID"""
        session1 = session_manager.create_session("user1")
        session2 = session_manager.create_session("user2")
        
        assert session1.session_id != session2.session_id
    
    def test_create_session_sets_timestamps(self, session_manager):
        """测试创建会话设置时间戳"""
        session = session_manager.create_session("user1")
        
        assert session.created_at is not None
        assert session.expires_at is not None
        
        # 验证时间戳格式
        created = datetime.fromisoformat(session.created_at)
        expires = datetime.fromisoformat(session.expires_at)
        
        # 验证过期时间大约是 10 分钟后
        time_diff = (expires - created).total_seconds()
        assert 590 <= time_diff <= 610  # 允许小误差
    
    def test_create_session_stores_in_redis(self, session_manager, mock_redis):
        """测试创建会话存储到 Redis"""
        session = session_manager.create_session("user1")
        
        session_key = f"session:{session.session_id}"
        assert session_key in mock_redis.data
        
        # 验证存储的数据可以反序列化
        stored_data = mock_redis.data[session_key]
        session_dict = json.loads(stored_data)
        assert session_dict["user_id"] == "user1"
        assert session_dict["session_id"] == session.session_id


class TestSessionRetrieval:
    """测试会话获取功能"""
    
    def test_get_session_returns_existing_session(self, session_manager):
        """测试获取存在的会话"""
        # 创建会话
        created_session = session_manager.create_session("user1")
        
        # 获取会话
        retrieved_session = session_manager.get_session(created_session.session_id)
        
        assert retrieved_session is not None
        assert retrieved_session.session_id == created_session.session_id
        assert retrieved_session.user_id == created_session.user_id
    
    def test_get_session_returns_none_for_nonexistent(self, session_manager):
        """测试获取不存在的会话返回 None"""
        result = session_manager.get_session("nonexistent_id")
        assert result is None
    
    def test_get_session_handles_corrupted_data(self, session_manager, mock_redis):
        """测试处理损坏的会话数据"""
        # 存储损坏的 JSON 数据
        session_key = "session:corrupted"
        mock_redis.data[session_key] = "invalid json {"
        
        result = session_manager.get_session("corrupted")
        
        assert result is None
        # 验证损坏的数据被删除
        assert session_key not in mock_redis.data


class TestSessionUpdate:
    """测试会话更新功能"""
    
    def test_update_context_updates_field(self, session_manager):
        """测试更新会话字段"""
        session = session_manager.create_session("user1")
        
        # 更新状态
        session_manager.update_context(
            session.session_id,
            "current_state",
            "PROCESSING"
        )
        
        # 验证更新
        updated_session = session_manager.get_session(session.session_id)
        assert updated_session.current_state == "PROCESSING"
    
    def test_update_context_raises_for_nonexistent_session(self, session_manager):
        """测试更新不存在的会话抛出异常"""
        with pytest.raises(ValueError, match="not found or expired"):
            session_manager.update_context("nonexistent", "current_state", "NEW")
    
    def test_update_context_raises_for_invalid_field(self, session_manager):
        """测试更新无效字段抛出异常"""
        session = session_manager.create_session("user1")
        
        with pytest.raises(ValueError, match="Invalid session field"):
            session_manager.update_context(
                session.session_id,
                "invalid_field",
                "value"
            )
    
    def test_update_context_preserves_ttl(self, session_manager, mock_redis):
        """测试更新会话保持 TTL"""
        session = session_manager.create_session("user1")
        session_key = f"session:{session.session_id}"
        
        # 模拟 TTL 减少
        mock_redis.ttls[session_key] = 300  # 5 分钟剩余
        
        # 更新会话
        session_manager.update_context(session.session_id, "current_state", "NEW")
        
        # 验证使用剩余 TTL
        assert mock_redis.ttls[session_key] == 300


class TestConversationHistory:
    """测试对话历史功能"""
    
    def test_add_conversation_message(self, session_manager):
        """测试添加对话消息"""
        session = session_manager.create_session("user1")
        
        session_manager.add_conversation_message(
            session.session_id,
            role="user",
            content="我想买一个 NFT"
        )
        
        updated_session = session_manager.get_session(session.session_id)
        assert len(updated_session.conversation_history) == 1
        
        message = updated_session.conversation_history[0]
        assert message["role"] == "user"
        assert message["content"] == "我想买一个 NFT"
        assert "timestamp" in message
    
    def test_add_conversation_message_with_metadata(self, session_manager):
        """测试添加带元数据的对话消息"""
        session = session_manager.create_session("user1")
        
        metadata = {"intent": "PURCHASE", "confidence": 0.95}
        session_manager.add_conversation_message(
            session.session_id,
            role="assistant",
            content="好的，我帮您查找",
            metadata=metadata
        )
        
        updated_session = session_manager.get_session(session.session_id)
        message = updated_session.conversation_history[0]
        assert message["metadata"] == metadata
    
    def test_get_conversation_history(self, session_manager):
        """测试获取对话历史"""
        session = session_manager.create_session("user1")
        
        # 添加多条消息
        for i in range(5):
            session_manager.add_conversation_message(
                session.session_id,
                role="user",
                content=f"Message {i}"
            )
        
        # 获取全部历史
        history = session_manager.get_conversation_history(session.session_id)
        assert len(history) == 5
        
        # 获取最近 3 条
        recent = session_manager.get_conversation_history(session.session_id, last_n=3)
        assert len(recent) == 3
        assert recent[0]["content"] == "Message 2"


class TestProductManagement:
    """测试商品管理功能"""
    
    def test_add_selected_product(self, session_manager):
        """测试添加选中商品"""
        session = session_manager.create_session("user1")
        
        product = {
            "id": "prod_123",
            "name": "Test NFT",
            "price": "0.5",
            "currency": "MATIC"
        }
        
        session_manager.add_selected_product(session.session_id, product)
        
        updated_session = session_manager.get_session(session.session_id)
        assert len(updated_session.selected_products) == 1
        assert updated_session.selected_products[0]["id"] == "prod_123"
    
    def test_clear_selected_products(self, session_manager):
        """测试清空选中商品"""
        session = session_manager.create_session("user1")
        
        # 添加商品
        product = {"id": "prod_123", "name": "Test NFT"}
        session_manager.add_selected_product(session.session_id, product)
        
        # 清空
        session_manager.clear_selected_products(session.session_id)
        
        updated_session = session_manager.get_session(session.session_id)
        assert len(updated_session.selected_products) == 0


class TestSessionLifecycle:
    """测试会话生命周期管理"""
    
    def test_delete_session(self, session_manager):
        """测试删除会话"""
        session = session_manager.create_session("user1")
        
        # 删除会话
        result = session_manager.delete_session(session.session_id)
        assert result is True
        
        # 验证会话不存在
        retrieved = session_manager.get_session(session.session_id)
        assert retrieved is None
    
    def test_delete_nonexistent_session(self, session_manager):
        """测试删除不存在的会话"""
        result = session_manager.delete_session("nonexistent")
        assert result is False
    
    def test_extend_session(self, session_manager, mock_redis):
        """测试延长会话过期时间"""
        session = session_manager.create_session("user1")
        session_key = f"session:{session.session_id}"
        
        # 延长会话
        result = session_manager.extend_session(session.session_id, 1200)
        assert result is True
        assert mock_redis.ttls[session_key] == 1200
    
    def test_extend_nonexistent_session(self, session_manager):
        """测试延长不存在的会话"""
        result = session_manager.extend_session("nonexistent")
        assert result is False


class TestEdgeCases:
    """测试边缘情况"""
    
    def test_empty_conversation_history(self, session_manager):
        """测试空对话历史"""
        session = session_manager.create_session("user1")
        history = session_manager.get_conversation_history(session.session_id)
        assert history == []
    
    def test_get_conversation_history_for_nonexistent_session(self, session_manager):
        """测试获取不存在会话的对话历史"""
        history = session_manager.get_conversation_history("nonexistent")
        assert history == []
    
    def test_multiple_products_in_session(self, session_manager):
        """测试会话中添加多个商品"""
        session = session_manager.create_session("user1")
        
        products = [
            {"id": "prod_1", "name": "NFT 1"},
            {"id": "prod_2", "name": "NFT 2"},
            {"id": "prod_3", "name": "NFT 3"}
        ]
        
        for product in products:
            session_manager.add_selected_product(session.session_id, product)
        
        updated_session = session_manager.get_session(session.session_id)
        assert len(updated_session.selected_products) == 3
