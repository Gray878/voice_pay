"""
Semantic Parser 单元测试
测试语义解析器的核心功能（不依赖 LLM 的部分）
"""

import pytest
import os

# Mock 环境变量
os.environ['OPENAI_API_KEY'] = 'test-key'
os.environ['PINECONE_API_KEY'] = 'test-key'
os.environ['POSTGRES_PASSWORD'] = 'test-password'

from semantic_parser import (
    IntentType,
    ParsedIntent,
    EntityExtraction
)


class TestIntentType:
    """IntentType 枚举测试"""
    
    def test_intent_types(self):
        """测试所有意图类型"""
        assert IntentType.QUERY.value == "query"
        assert IntentType.PURCHASE.value == "purchase"
        assert IntentType.CONFIRM.value == "confirm"
        assert IntentType.CANCEL.value == "cancel"
        assert IntentType.HELP.value == "help"
        assert IntentType.HISTORY.value == "history"


class TestParsedIntent:
    """ParsedIntent 数据类测试"""
    
    def test_parsed_intent_creation(self):
        """测试创建 ParsedIntent 对象"""
        intent = ParsedIntent(
            intent=IntentType.QUERY,
            entities={'product_type': 'NFT'},
            confidence=0.9,
            missing_info=[]
        )
        
        assert intent.intent == IntentType.QUERY
        assert intent.entities['product_type'] == 'NFT'
        assert intent.confidence == 0.9
        assert len(intent.missing_info) == 0


class TestEntityExtraction:
    """EntityExtraction Pydantic 模型测试"""
    
    def test_entity_extraction_model(self):
        """测试实体提取模型"""
        entity = EntityExtraction(
            product_type="NFT",
            category="音乐会",
            price_max=100,
            currency="MATIC"
        )
        
        assert entity.product_type == "NFT"
        assert entity.category == "音乐会"
        assert entity.price_max == 100
        assert entity.currency == "MATIC"
    
    def test_entity_extraction_optional_fields(self):
        """测试可选字段"""
        entity = EntityExtraction(product_type="Token")
        
        assert entity.product_type == "Token"
        assert entity.category is None
        assert entity.price_min is None


class TestSemanticParserHelpers:
    """测试 SemanticParser 的辅助方法（不需要 LLM）"""
    
    def test_parse_llm_response_json(self):
        """测试解析 JSON 响应"""
        from semantic_parser import SemanticParser
        
        # 创建一个临时实例来测试静态方法
        parser = SemanticParser.__new__(SemanticParser)
        
        response = '{"intent": "query", "entities": {}, "confidence": 0.8}'
        result = parser._parse_llm_response(response)
        
        assert result['intent'] == 'query'
        assert result['confidence'] == 0.8
    
    def test_parse_llm_response_json_block(self):
        """测试解析 JSON 代码块"""
        from semantic_parser import SemanticParser
        
        parser = SemanticParser.__new__(SemanticParser)
        
        response = '''这是一些文本
```json
{"intent": "query", "entities": {}}
```
更多文本'''
        
        result = parser._parse_llm_response(response)
        assert result['intent'] == 'query'
    
    def test_parse_llm_response_invalid(self):
        """测试解析无效响应"""
        from semantic_parser import SemanticParser
        
        parser = SemanticParser.__new__(SemanticParser)
        
        response = "这不是 JSON"
        result = parser._parse_llm_response(response)
        
        # 应该返回默认的帮助意图
        assert result['intent'] == 'help'
        assert result['confidence'] == 0.0
    
    def test_resolve_reference_ordinal(self):
        """测试序号引用解析"""
        from semantic_parser import SemanticParser
        
        parser = SemanticParser.__new__(SemanticParser)
        
        context = {
            'selected_products': [
                {'id': 'nft-001', 'name': '商品1'},
                {'id': 'nft-002', 'name': '商品2'}
            ]
        }
        
        # 测试"第一个"
        result = parser.resolve_reference("买第一个", context)
        assert result is not None
        assert result['product_id'] == 'nft-001'
        assert result['reference_resolved'] is True
        
        # 测试"第二个"
        result = parser.resolve_reference("选择第二个", context)
        assert result is not None
        assert result['product_id'] == 'nft-002'
    
    def test_resolve_reference_demonstrative(self):
        """测试指示代词引用解析"""
        from semantic_parser import SemanticParser
        
        parser = SemanticParser.__new__(SemanticParser)
        
        context = {
            'selected_products': [
                {'id': 'nft-001', 'name': '商品1'},
                {'id': 'nft-002', 'name': '商品2'}
            ]
        }
        
        # 测试"这个"（应该引用最后一个）
        result = parser.resolve_reference("买这个", context)
        assert result is not None
        assert result['product_id'] == 'nft-002'
    
    def test_resolve_reference_no_products(self):
        """测试没有商品时的引用解析"""
        from semantic_parser import SemanticParser
        
        parser = SemanticParser.__new__(SemanticParser)
        
        context = {'selected_products': []}
        
        result = parser.resolve_reference("买第一个", context)
        assert result is None
    
    def test_resolve_reference_out_of_range(self):
        """测试超出范围的引用"""
        from semantic_parser import SemanticParser
        
        parser = SemanticParser.__new__(SemanticParser)
        
        context = {
            'selected_products': [
                {'id': 'nft-001', 'name': '商品1'}
            ]
        }
        
        result = parser.resolve_reference("买第五个", context)
        assert result is None


class TestIntentType:
    """IntentType 枚举测试"""
    
    def test_intent_types(self):
        """测试所有意图类型"""
        assert IntentType.QUERY.value == "query"
        assert IntentType.PURCHASE.value == "purchase"
        assert IntentType.CONFIRM.value == "confirm"
        assert IntentType.CANCEL.value == "cancel"
        assert IntentType.HELP.value == "help"
        assert IntentType.HISTORY.value == "history"


class TestParsedIntent:
    """ParsedIntent 数据类测试"""
    
    def test_parsed_intent_creation(self):
        """测试创建 ParsedIntent 对象"""
        intent = ParsedIntent(
            intent=IntentType.QUERY,
            entities={'product_type': 'NFT'},
            confidence=0.9,
            missing_info=[]
        )
        
        assert intent.intent == IntentType.QUERY
        assert intent.entities['product_type'] == 'NFT'
        assert intent.confidence == 0.9
        assert len(intent.missing_info) == 0


class TestEntityExtraction:
    """EntityExtraction Pydantic 模型测试"""
    
    def test_entity_extraction_model(self):
        """测试实体提取模型"""
        entity = EntityExtraction(
            product_type="NFT",
            category="音乐会",
            price_max=100,
            currency="MATIC"
        )
        
        assert entity.product_type == "NFT"
        assert entity.category == "音乐会"
        assert entity.price_max == 100
        assert entity.currency == "MATIC"
    
    def test_entity_extraction_optional_fields(self):
        """测试可选字段"""
        entity = EntityExtraction(product_type="Token")
        
        assert entity.product_type == "Token"
        assert entity.category is None
        assert entity.price_min is None
