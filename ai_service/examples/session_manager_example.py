"""
SessionManager 使用示例
演示如何使用会话管理器进行多轮对话
"""

import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 设置测试环境变量
os.environ.setdefault("OPENAI_API_KEY", "test_key")
os.environ.setdefault("PINECONE_API_KEY", "test_key")
os.environ.setdefault("POSTGRES_PASSWORD", "test_password")

from session_manager import SessionManager
from unittest.mock import Mock


def main():
    """主函数：演示 SessionManager 的使用"""
    
    print("=" * 60)
    print("SessionManager 使用示例")
    print("=" * 60)
    
    # 创建 Mock Redis 客户端（用于演示）
    mock_redis = Mock()
    mock_redis.data = {}
    mock_redis.ttls = {}
    
    def setex(key, ttl, value):
        mock_redis.data[key] = value
        mock_redis.ttls[key] = ttl
        return True
    
    def get(key):
        return mock_redis.data.get(key)
    
    def delete(key):
        if key in mock_redis.data:
            del mock_redis.data[key]
            if key in mock_redis.ttls:
                del mock_redis.ttls[key]
            return 1
        return 0
    
    def ttl(key):
        return mock_redis.ttls.get(key, -1)
    
    def expire(key, seconds):
        if key in mock_redis.data:
            mock_redis.ttls[key] = seconds
            return True
        return False
    
    mock_redis.setex = setex
    mock_redis.get = get
    mock_redis.delete = delete
    mock_redis.ttl = ttl
    mock_redis.expire = expire
    
    # 创建 SessionManager
    session_manager = SessionManager(redis_client=mock_redis)
    
    # 1. 创建新会话
    print("\n1. 创建新会话")
    print("-" * 60)
    session = session_manager.create_session(user_id="user_alice")
    print(f"✓ 会话已创建")
    print(f"  Session ID: {session.session_id}")
    print(f"  User ID: {session.user_id}")
    print(f"  状态: {session.current_state}")
    print(f"  创建时间: {session.created_at}")
    print(f"  过期时间: {session.expires_at}")
    
    # 2. 模拟用户对话
    print("\n2. 模拟用户对话")
    print("-" * 60)
    
    # 用户第一轮对话
    print("\n用户: 我想买一个元宇宙音乐派对的 NFT")
    session_manager.add_conversation_message(
        session.session_id,
        role="user",
        content="我想买一个元宇宙音乐派对的 NFT",
        metadata={"intent": "QUERY", "confidence": 0.95}
    )
    
    # 系统响应
    print("助手: 好的，我帮您查找元宇宙音乐派对相关的 NFT...")
    session_manager.add_conversation_message(
        session.session_id,
        role="assistant",
        content="好的，我帮您查找元宇宙音乐派对相关的 NFT..."
    )
    
    # 更新会话状态
    session_manager.update_context(session.session_id, "current_state", "SEARCHING")
    print("✓ 会话状态更新为: SEARCHING")
    
    # 3. 添加查询结果
    print("\n3. 添加查询结果")
    print("-" * 60)
    
    products = [
        {
            "id": "nft_001",
            "name": "Metaverse Music Festival Pass",
            "description": "元宇宙音乐节通行证 NFT",
            "price": "0.5",
            "currency": "MATIC",
            "chain": "polygon",
            "contract_address": "0x1234...5678"
        },
        {
            "id": "nft_002",
            "name": "VIP Backstage Access NFT",
            "description": "VIP 后台通行证 NFT",
            "price": "1.2",
            "currency": "MATIC",
            "chain": "polygon",
            "contract_address": "0xabcd...efgh"
        }
    ]
    
    for i, product in enumerate(products, 1):
        session_manager.add_selected_product(session.session_id, product)
        print(f"✓ 商品 {i}: {product['name']} - {product['price']} {product['currency']}")
    
    # 系统播报结果
    print("\n助手: 我找到了 2 个相关的 NFT，第一个是元宇宙音乐节通行证...")
    session_manager.add_conversation_message(
        session.session_id,
        role="assistant",
        content="我找到了 2 个相关的 NFT，第一个是元宇宙音乐节通行证..."
    )
    
    # 4. 用户选择商品
    print("\n4. 用户选择商品")
    print("-" * 60)
    
    print("\n用户: 我要第一个")
    session_manager.add_conversation_message(
        session.session_id,
        role="user",
        content="我要第一个",
        metadata={"intent": "PURCHASE", "product_index": 0}
    )
    
    # 更新会话状态
    session_manager.update_context(session.session_id, "current_state", "CONFIRMING")
    print("✓ 会话状态更新为: CONFIRMING")
    
    # 5. 查看会话信息
    print("\n5. 查看会话信息")
    print("-" * 60)
    
    updated_session = session_manager.get_session(session.session_id)
    print(f"当前状态: {updated_session.current_state}")
    print(f"对话轮数: {len(updated_session.conversation_history)}")
    print(f"选中商品数: {len(updated_session.selected_products)}")
    
    # 6. 查看对话历史
    print("\n6. 查看对话历史（最近 3 条）")
    print("-" * 60)
    
    recent_history = session_manager.get_conversation_history(
        session.session_id,
        last_n=3
    )
    
    for i, msg in enumerate(recent_history, 1):
        role_emoji = "👤" if msg["role"] == "user" else "🤖"
        print(f"{role_emoji} {msg['role']}: {msg['content']}")
    
    # 7. 延长会话
    print("\n7. 延长会话时间")
    print("-" * 60)
    
    result = session_manager.extend_session(session.session_id, 1200)
    if result:
        print("✓ 会话已延长 20 分钟")
    
    # 8. 清理会话
    print("\n8. 清理会话")
    print("-" * 60)
    
    # 清空选中商品
    session_manager.clear_selected_products(session.session_id)
    print("✓ 已清空选中商品")
    
    # 删除会话
    result = session_manager.delete_session(session.session_id)
    if result:
        print("✓ 会话已删除")
    
    # 验证会话已删除
    deleted_session = session_manager.get_session(session.session_id)
    if deleted_session is None:
        print("✓ 确认会话已不存在")
    
    print("\n" + "=" * 60)
    print("示例完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
