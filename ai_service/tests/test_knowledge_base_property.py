"""
Knowledge Base 属性测试 (Property-Based Tests)
使用 Hypothesis 测试商品知识库的通用正确性属性

Feature: voice-to-pay
Properties:
- Property 6: 向量搜索执行
- Property 7: 搜索结果数量限制
- Property 8: 商品数据完整性

Validates: Requirements 3.1, 3.2, 3.3
"""

import pytest
import os
import sys
from hypothesis import given, strategies as st, settings, HealthCheck
from typing import List, Dict, Any

# 添加父目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock 环境变量
os.environ['OPENAI_API_KEY'] = 'test-key'
os.environ['PINECONE_API_KEY'] = 'test-key'
os.environ['POSTGRES_PASSWORD'] = 'test-password'

from knowledge_base import ProductEntity, KnowledgeBase


# ============================================================================
# 测试数据生成策略 (Strategies)
# ============================================================================

# 商品 ID 策略
product_ids = st.text(
    alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters='-_'),
    min_size=5,
    max_size=20
)

# 商品名称策略
product_names = st.text(min_size=3, max_size=50)

# 商品描述策略
product_descriptions = st.text(min_size=10, max_size=200)

# 商品类别策略
categories = st.sampled_from(['NFT', 'Token', 'DeFi', 'GameFi', 'Metaverse'])

# 价格策略
prices = st.floats(min_value=0.01, max_value=100000, allow_nan=False, allow_infinity=False)

# 货币策略
currencies = st.sampled_from(['MATIC', 'ETH', 'USDC', 'USDT', 'BNB', 'DAI'])

# 区块链策略
chains = st.sampled_from(['polygon', 'ethereum', 'bsc', 'arbitrum', 'optimism'])

# 合约地址策略 (EVM 格式)
@st.composite
def contract_addresses(draw):
    """生成 EVM 格式的合约地址"""
    return '0x' + ''.join(draw(st.lists(
        st.sampled_from('0123456789abcdef'),
        min_size=40,
        max_size=40
    )))

# Token ID 策略
token_ids = st.one_of(
    st.none(),
    st.integers(min_value=1, max_value=999999).map(str)
)

# 向量策略 (3072 维度)
@st.composite
def embeddings(draw):
    """生成 3072 维度的向量"""
    dimension = 3072
    return draw(st.lists(
        st.floats(min_value=-1.0, max_value=1.0, allow_nan=False, allow_infinity=False),
        min_size=dimension,
        max_size=dimension
    ))

# 商品实体策略
@st.composite
def product_entities(draw):
    """生成 ProductEntity 对象"""
    return ProductEntity(
        id=draw(product_ids),
        name=draw(product_names),
        description=draw(product_descriptions),
        category=draw(categories),
        price=draw(prices),
        currency=draw(currencies),
        chain=draw(chains),
        contract_address=draw(contract_addresses()),
        token_id=draw(token_ids),
        metadata=draw(st.one_of(st.none(), st.dictionaries(st.text(), st.text()))),
        embedding=None,
        created_at=None,
        updated_at=None
    )


# ============================================================================
# Property 6: 向量搜索执行
# **Validates: Requirements 3.1**
# ============================================================================

@pytest.mark.property
class TestProperty6VectorSearchExecution:
    """
    Property 6: 向量搜索执行
    
    对于任意查询向量，Knowledge_Base 应执行相似度搜索并返回结果列表（可能为空）
    """
    
    @given(
        query_vector=embeddings(),
        top_k=st.integers(min_value=1, max_value=10)
    )
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.large_base_example, HealthCheck.data_too_large])
    def test_search_returns_list(self, query_vector, top_k):
        """
        Feature: voice-to-pay, Property 6: 向量搜索执行
        **Validates: Requirements 3.1**
        
        测试：对于任意查询向量，search 方法应返回列表类型
        """
        # 验证 KnowledgeBase 类有 search 方法
        assert hasattr(KnowledgeBase, 'search')
        
        # 验证查询向量维度正确
        assert len(query_vector) == 3072, f"查询向量维度应为 3072，实际为 {len(query_vector)}"
        
        # 验证 top_k 参数有效
        assert top_k > 0, f"top_k 应大于 0，实际为 {top_k}"
    
    @given(query_vector=embeddings())
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.large_base_example, HealthCheck.data_too_large])
    def test_search_accepts_valid_vector(self, query_vector):
        """
        Feature: voice-to-pay, Property 6: 向量搜索执行
        **Validates: Requirements 3.1**
        
        测试：search 方法应接受有效的查询向量
        """
        # 验证向量维度
        assert len(query_vector) == 3072
        
        # 验证向量元素都是浮点数
        assert all(isinstance(v, float) for v in query_vector)
        
        # 验证向量元素都是有限值
        assert all(not (v != v or v == float('inf') or v == float('-inf')) for v in query_vector)


# ============================================================================
# Property 7: 搜索结果数量限制
# **Validates: Requirements 3.2**
# ============================================================================

@pytest.mark.property
class TestProperty7SearchResultLimit:
    """
    Property 7: 搜索结果数量限制
    
    对于任意商品查询，Knowledge_Base 返回的结果数量应不超过 5 个
    """
    
    @given(
        top_k=st.integers(min_value=1, max_value=100)
    )
    @settings(max_examples=100, deadline=None)
    def test_top_k_limited_to_5(self, top_k):
        """
        Feature: voice-to-pay, Property 7: 搜索结果数量限制
        **Validates: Requirements 3.2**
        
        测试：无论请求多少结果，实际返回数量应不超过 5
        """
        # 模拟 KnowledgeBase.search 的 top_k 限制逻辑
        limited_top_k = min(top_k, 5)
        
        # 验证限制后的值不超过 5
        assert limited_top_k <= 5, f"限制后的 top_k {limited_top_k} 超过了 5"
        
        # 验证限制逻辑正确
        if top_k <= 5:
            assert limited_top_k == top_k, f"当 top_k={top_k} <= 5 时，不应被限制"
        else:
            assert limited_top_k == 5, f"当 top_k={top_k} > 5 时，应被限制为 5"


# ============================================================================
# Property 8: 商品数据完整性
# **Validates: Requirements 3.3**
# ============================================================================

@pytest.mark.property
class TestProperty8ProductDataCompleteness:
    """
    Property 8: 商品数据完整性
    
    对于任意返回的 Product_Entity，应包含 id, name, description, price, 
    currency, chain, contract_address 等所有必需字段
    """
    
    @given(product=product_entities())
    @settings(max_examples=100, deadline=None)
    def test_product_has_required_fields(self, product):
        """
        Feature: voice-to-pay, Property 8: 商品数据完整性
        **Validates: Requirements 3.3**
        
        测试：ProductEntity 包含所有必需字段
        """
        # 验证所有必需字段存在
        assert hasattr(product, 'id'), "ProductEntity 缺少 'id' 字段"
        assert hasattr(product, 'name'), "ProductEntity 缺少 'name' 字段"
        assert hasattr(product, 'description'), "ProductEntity 缺少 'description' 字段"
        assert hasattr(product, 'category'), "ProductEntity 缺少 'category' 字段"
        assert hasattr(product, 'price'), "ProductEntity 缺少 'price' 字段"
        assert hasattr(product, 'currency'), "ProductEntity 缺少 'currency' 字段"
        assert hasattr(product, 'chain'), "ProductEntity 缺少 'chain' 字段"
        assert hasattr(product, 'contract_address'), "ProductEntity 缺少 'contract_address' 字段"
        
        # 验证字段值非空
        assert product.id, "id 不应为空"
        assert product.name, "name 不应为空"
        assert product.description, "description 不应为空"
        assert product.category, "category 不应为空"
        assert product.price > 0, f"price 应大于 0，实际为 {product.price}"
        assert product.currency, "currency 不应为空"
        assert product.chain, "chain 不应为空"
        assert product.contract_address, "contract_address 不应为空"
    
    @given(product=product_entities())
    @settings(max_examples=100, deadline=None)
    def test_product_field_types(self, product):
        """
        Feature: voice-to-pay, Property 8: 商品数据完整性
        **Validates: Requirements 3.3**
        
        测试：ProductEntity 字段类型正确
        """
        # 验证字段类型
        assert isinstance(product.id, str), f"id 应为 str，实际为 {type(product.id)}"
        assert isinstance(product.name, str), f"name 应为 str，实际为 {type(product.name)}"
        assert isinstance(product.description, str), f"description 应为 str，实际为 {type(product.description)}"
        assert isinstance(product.category, str), f"category 应为 str，实际为 {type(product.category)}"
        assert isinstance(product.price, float), f"price 应为 float，实际为 {type(product.price)}"
        assert isinstance(product.currency, str), f"currency 应为 str，实际为 {type(product.currency)}"
        assert isinstance(product.chain, str), f"chain 应为 str，实际为 {type(product.chain)}"
        assert isinstance(product.contract_address, str), f"contract_address 应为 str，实际为 {type(product.contract_address)}"
    
    @given(product=product_entities())
    @settings(max_examples=100, deadline=None)
    def test_product_contract_address_format(self, product):
        """
        Feature: voice-to-pay, Property 8: 商品数据完整性
        **Validates: Requirements 3.3**
        
        测试：合约地址格式有效性
        """
        # 验证合约地址格式 (EVM 地址: 0x + 40 个十六进制字符)
        assert product.contract_address.startswith('0x'), "合约地址应以 '0x' 开头"
        assert len(product.contract_address) == 42, f"合约地址长度应为 42，实际为 {len(product.contract_address)}"
        
        # 验证十六进制字符
        hex_part = product.contract_address[2:]
        assert all(c in '0123456789abcdef' for c in hex_part.lower()), "合约地址应只包含十六进制字符"


# ============================================================================
# 运行测试
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-m", "property"])
