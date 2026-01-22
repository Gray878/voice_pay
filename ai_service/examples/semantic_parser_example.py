"""
Semantic Parser 使用示例
演示如何使用语义解析器进行意图识别和实体提取
"""

import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from semantic_parser import SemanticParser, IntentType
from session_manager import SessionManager


def example_basic_parsing():
    """示例 1: 基本解析"""
    print("=" * 60)
    print("示例 1: 基本意图识别和实体提取")
    print("=" * 60)
    
    parser = SemanticParser()
    
    test_inputs = [
        "帮我买一个能进元宇宙音乐派对的 NFT",
        "我想要一个价格在 100 MATIC 以下的游戏道具",
        "确认购买",
        "取消",
        "我之前买过什么"
    ]
    
    for text in test_inputs:
        print(f"\n用户输入: {text}")
        intent = parser.parse(text)
        print(f"  意图: {intent.intent.value}")
        print(f"  置信度: {intent.confidence:.2f}")
        print(f"  实体: {intent.entities}")
        if intent.missing_info:
            print(f"  缺失信息: {intent.missing_info}")
    
    parser.clear_memory()


def example_entity_extraction():
    """示例 2: 实体提取"""
    print("\n" + "=" * 60)
    print("示例 2: 详细实体提取")
    print("=" * 60)
    
    parser = SemanticParser()
    
    text = "我想买一个 Polygon 链上的音乐会 NFT，价格不超过 50 MATIC"
    print(f"\n用户输入: {text}")
    
    entities = parser.extract_entities(text)
    print(f"提取的实体:")
    for key, value in entities.items():
        print(f"  {key}: {value}")


def example_multi_turn_conversation():
    """示例 3: 多轮对话"""
    print("\n" + "=" * 60)
    print("示例 3: 多轮对话上下文管理")
    print("=" * 60)
    
    parser = SemanticParser()
    session_mgr = SessionManager()
    
    # 创建会话
    session = session_mgr.create_session(user_id="demo_user")
    print(f"\n创建会话: {session.session_id}")
    
    # 第一轮：查询商品
    text1 = "我想买一个游戏道具 NFT"
    print(f"\n[第 1 轮] 用户: {text1}")
    
    intent1 = parser.parse(text1)
    print(f"  系统识别: {intent1.intent.value}")
    print(f"  提取实体: {intent1.entities}")
    
    # 保存对话历史
    session_mgr.add_conversation_message(
        session.session_id,
        role="user",
        content=text1
    )
    session_mgr.add_conversation_message(
        session.session_id,
        role="assistant",
        content="找到以下游戏道具..."
    )
    
    # 模拟添加商品到会话
    mock_products = [
        {'id': 'nft-001', 'name': '传奇之剑 NFT', 'price': 50},
        {'id': 'nft-002', 'name': '魔法盾牌 NFT', 'price': 30}
    ]
    for product in mock_products:
        session_mgr.add_selected_product(session.session_id, product)
    
    # 第二轮：引用商品
    text2 = "买第一个"
    print(f"\n[第 2 轮] 用户: {text2}")
    
    # 获取更新后的会话
    session = session_mgr.get_session(session.session_id)
    
    intent2 = parser.parse(text2, session_context={
        'conversation_history': session.conversation_history,
        'selected_products': session.selected_products
    })
    
    print(f"  系统识别: {intent2.intent.value}")
    print(f"  解析的引用: {intent2.entities}")
    
    # 第三轮：确认
    text3 = "确认购买"
    print(f"\n[第 3 轮] 用户: {text3}")
    
    intent3 = parser.parse(text3)
    print(f"  系统识别: {intent3.intent.value}")
    
    # 清理
    session_mgr.delete_session(session.session_id)
    parser.clear_memory()


def example_reference_resolution():
    """示例 4: 指代消解"""
    print("\n" + "=" * 60)
    print("示例 4: 指代词解析")
    print("=" * 60)
    
    parser = SemanticParser()
    
    # 模拟上下文
    context = {
        'selected_products': [
            {'id': 'nft-001', 'name': '音乐会门票 NFT', 'price': 100},
            {'id': 'nft-002', 'name': '游戏道具 NFT', 'price': 50},
            {'id': 'nft-003', 'name': '艺术品 NFT', 'price': 200}
        ]
    }
    
    test_references = [
        "第一个",
        "第二个",
        "这个",
        "买它"
    ]
    
    for text in test_references:
        print(f"\n用户输入: {text}")
        resolved = parser.resolve_reference(text, context)
        if resolved:
            print(f"  解析结果: {resolved}")
        else:
            print(f"  无法解析")


def example_conversation_summary():
    """示例 5: 对话摘要"""
    print("\n" + "=" * 60)
    print("示例 5: 对话摘要")
    print("=" * 60)
    
    parser = SemanticParser()
    
    # 模拟多轮对话
    conversations = [
        "我想买一个 NFT",
        "价格在 100 以下",
        "要游戏类的",
        "买第一个",
        "确认"
    ]
    
    for text in conversations:
        parser.parse(text)
    
    # 获取摘要
    summary = parser.get_conversation_summary()
    print(f"\n对话摘要:\n{summary}")
    
    parser.clear_memory()


def main():
    """运行所有示例"""
    print("\n" + "=" * 60)
    print("Semantic Parser 使用示例")
    print("=" * 60)
    
    try:
        example_basic_parsing()
        example_entity_extraction()
        example_multi_turn_conversation()
        example_reference_resolution()
        example_conversation_summary()
        
        print("\n" + "=" * 60)
        print("所有示例运行完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
