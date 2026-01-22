"""
Knowledge Base 使用示例
演示如何使用商品知识库进行搜索和管理
"""

import sys
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from knowledge_base import KnowledgeBase, ProductEntity


def example_search():
    """示例：搜索商品"""
    print("=== 示例 1: 文本语义搜索 ===\n")
    
    kb = KnowledgeBase()
    
    # 用户查询
    query = "我想买一个能进元宇宙音乐派对的 NFT"
    print(f"用户查询: {query}\n")
    
    # 搜索商品
    results = kb.search_by_text(query, top_k=5)
    
    print(f"找到 {len(results)} 个相关商品:\n")
    for i, product in enumerate(results, 1):
        print(f"{i}. {product.name}")
        print(f"   价格: {product.price} {product.currency}")
        print(f"   描述: {product.description}")
        print(f"   链: {product.chain}")
        print()


def example_filter_search():
    """示例：带过滤条件的搜索"""
    print("=== 示例 2: 带过滤条件的搜索 ===\n")
    
    kb = KnowledgeBase()
    
    # 查询：价格在 100 MATIC 以下的 NFT
    query = "数字艺术"
    print(f"查询: {query}")
    print(f"过滤条件: 价格 <= 100 MATIC, 类别 = NFT\n")
    
    query_vector = kb.generate_embedding(query)
    results = kb.search(
        query_vector=query_vector,
        top_k=5,
        filters={
            "price": {"$lte": 100},
            "category": "NFT"
        }
    )
    
    print(f"找到 {len(results)} 个符合条件的商品:\n")
    for i, product in enumerate(results, 1):
        print(f"{i}. {product.name} - {product.price} {product.currency}")


def main():
    """运行所有示例"""
    try:
        example_search()
        print("\n" + "="*60 + "\n")
        
        example_filter_search()
        
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
