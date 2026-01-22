"""
会话管理模块 (Session Manager)
负责维护用户会话和上下文，使用 Redis 存储
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, asdict, field
import redis
from config import settings


@dataclass
class UserSession:
    """用户会话数据模型"""
    session_id: str
    user_id: str
    conversation_history: List[Dict] = field(default_factory=list)
    selected_products: List[Dict] = field(default_factory=list)  # 存储商品字典而非对象
    current_state: str = "IDLE"
    created_at: str = ""  # ISO 格式字符串
    expires_at: str = ""  # ISO 格式字符串
    
    def __post_init__(self):
        """初始化时间戳"""
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()
        if not self.expires_at:
            expires = datetime.utcnow() + timedelta(seconds=settings.session_ttl)
            self.expires_at = expires.isoformat()


class SessionManager:
    """
    会话管理器
    
    职责：
    - 创建和管理用户会话
    - 使用 Redis 存储会话数据（TTL 10 分钟）
    - 实现会话序列化/反序列化（JSON）
    
    Requirements: 12.1, 12.2
    """
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        """
        初始化会话管理器
        
        Args:
            redis_client: Redis 客户端实例，如果为 None 则创建新连接
        """
        if redis_client is None:
            self.redis_client = redis.Redis(
                host=settings.redis_host,
                port=settings.redis_port,
                db=settings.redis_db,
                password=settings.redis_password,
                decode_responses=True  # 自动解码为字符串
            )
        else:
            self.redis_client = redis_client
        
        self.session_ttl = settings.session_ttl  # 默认 600 秒（10 分钟）
    
    def _get_session_key(self, session_id: str) -> str:
        """
        生成 Redis 键名
        
        Args:
            session_id: 会话 ID
            
        Returns:
            Redis 键名
        """
        return f"session:{session_id}"
    
    def create_session(self, user_id: str) -> UserSession:
        """
        创建新会话
        
        Args:
            user_id: 用户 ID
            
        Returns:
            新创建的 UserSession 对象
            
        Requirements: 12.1
        """
        # 生成唯一的会话 ID
        session_id = str(uuid.uuid4())
        
        # 创建会话对象
        session = UserSession(
            session_id=session_id,
            user_id=user_id
        )
        
        # 序列化并存储到 Redis
        session_key = self._get_session_key(session_id)
        session_data = json.dumps(asdict(session))
        self.redis_client.setex(
            session_key,
            self.session_ttl,
            session_data
        )
        
        return session
    
    def get_session(self, session_id: str) -> Optional[UserSession]:
        """
        获取会话
        
        Args:
            session_id: 会话 ID
            
        Returns:
            UserSession 对象，如果不存在或已过期则返回 None
            
        Requirements: 12.2
        """
        session_key = self._get_session_key(session_id)
        session_data = self.redis_client.get(session_key)
        
        if session_data is None:
            return None
        
        # 反序列化
        try:
            session_dict = json.loads(session_data)
            return UserSession(**session_dict)
        except (json.JSONDecodeError, TypeError) as e:
            # 数据损坏，删除该会话
            self.redis_client.delete(session_key)
            return None
    
    def update_context(self, session_id: str, key: str, value: Any) -> None:
        """
        更新会话上下文
        
        Args:
            session_id: 会话 ID
            key: 要更新的字段名
            value: 新值
            
        Raises:
            ValueError: 如果会话不存在
            
        Requirements: 12.2
        """
        # 获取现有会话
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found or expired")
        
        # 更新字段
        if hasattr(session, key):
            setattr(session, key, value)
        else:
            raise ValueError(f"Invalid session field: {key}")
        
        # 保存回 Redis，保持原有的 TTL
        session_key = self._get_session_key(session_id)
        ttl = self.redis_client.ttl(session_key)
        
        # 如果 TTL 有效，使用剩余时间；否则使用默认 TTL
        if ttl > 0:
            expiry = ttl
        else:
            expiry = self.session_ttl
        
        session_data = json.dumps(asdict(session))
        self.redis_client.setex(session_key, expiry, session_data)
    
    def delete_session(self, session_id: str) -> bool:
        """
        删除会话
        
        Args:
            session_id: 会话 ID
            
        Returns:
            是否成功删除
        """
        session_key = self._get_session_key(session_id)
        result = self.redis_client.delete(session_key)
        return result > 0
    
    def extend_session(self, session_id: str, additional_seconds: int = None) -> bool:
        """
        延长会话过期时间
        
        Args:
            session_id: 会话 ID
            additional_seconds: 额外延长的秒数，默认为 session_ttl
            
        Returns:
            是否成功延长
        """
        if additional_seconds is None:
            additional_seconds = self.session_ttl
        
        session_key = self._get_session_key(session_id)
        return self.redis_client.expire(session_key, additional_seconds)
    
    def add_conversation_message(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict] = None
    ) -> None:
        """
        添加对话消息到会话历史
        
        Args:
            session_id: 会话 ID
            role: 角色（user/assistant/system）
            content: 消息内容
            metadata: 额外的元数据
        """
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found or expired")
        
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if metadata:
            message["metadata"] = metadata
        
        session.conversation_history.append(message)
        self.update_context(session_id, "conversation_history", session.conversation_history)
    
    def add_selected_product(self, session_id: str, product: Dict) -> None:
        """
        添加选中的商品到会话
        
        Args:
            session_id: 会话 ID
            product: 商品字典
        """
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found or expired")
        
        session.selected_products.append(product)
        self.update_context(session_id, "selected_products", session.selected_products)
    
    def clear_selected_products(self, session_id: str) -> None:
        """
        清空会话中的选中商品
        
        Args:
            session_id: 会话 ID
        """
        self.update_context(session_id, "selected_products", [])
    
    def get_conversation_history(
        self,
        session_id: str,
        last_n: Optional[int] = None
    ) -> List[Dict]:
        """
        获取对话历史
        
        Args:
            session_id: 会话 ID
            last_n: 获取最近 N 条消息，None 表示全部
            
        Returns:
            对话历史列表
        """
        session = self.get_session(session_id)
        if session is None:
            return []
        
        history = session.conversation_history
        if last_n is not None and last_n > 0:
            return history[-last_n:]
        return history
