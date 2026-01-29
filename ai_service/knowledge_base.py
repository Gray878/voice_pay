"""
商品知识库模块 (Knowledge Base Module)
使用本地数据文件存储和检索 Web3 商品信息
"""

from dataclasses import dataclass
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging
import json
import re
from pathlib import Path

from config import settings


logger = logging.getLogger(__name__)


@dataclass
class ProductEntity:
    """商品实体数据模型"""
    id: str
    name: str
    description: str
    category: str  # NFT, Token, etc.
    price: float
    currency: str  # MATIC, ETH, USDC, etc.
    chain: str  # polygon, ethereum, etc.
    contract_address: str
    token_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    embedding: Optional[List[float]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "price": str(self.price),
            "currency": self.currency,
            "chain": self.chain,
            "contract_address": self.contract_address,
            "token_id": self.token_id,
            "metadata": self.metadata or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProductEntity":
        """从字典创建实例"""
        created_at = None
        if data.get("created_at"):
            created_at = datetime.fromisoformat(data["created_at"])
        
        updated_at = None
        if data.get("updated_at"):
            updated_at = datetime.fromisoformat(data["updated_at"])
        
        return cls(
            id=data["id"],
            name=data["name"],
            description=data["description"],
            category=data["category"],
            price=float(data["price"]),
            currency=data["currency"],
            chain=data["chain"],
            contract_address=data["contract_address"],
            token_id=data.get("token_id"),
            metadata=data.get("metadata"),
            embedding=data.get("embedding"),
            created_at=created_at,
            updated_at=updated_at,
        )


class KnowledgeBase:
    """
    商品知识库类
    负责商品信息的存储、检索和本地搜索
    """
    
    def __init__(
        self,
        data_path: Optional[str] = None,
    ):
        base_path = Path(data_path) if data_path else Path(__file__).parent / "data" / "test_products.json"
        self.data_path = base_path
        self.products: List[ProductEntity] = []
        self._load_products()
        logger.info(f"KnowledgeBase 初始化完成，商品数量: {len(self.products)}")

    def _load_products(self) -> None:
        if not self.data_path.exists():
            self.products = []
            return
        try:
            with self.data_path.open("r", encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, list):
                self.products = [ProductEntity.from_dict(item) for item in raw if isinstance(item, dict)]
            else:
                self.products = []
        except Exception as e:
            logger.error(f"加载商品数据失败: {e}")
            self.products = []

    def _save_products(self) -> None:
        self.data_path.parent.mkdir(parents=True, exist_ok=True)
        with self.data_path.open("w", encoding="utf-8") as f:
            json.dump([p.to_dict() for p in self.products], f, ensure_ascii=False, indent=2)
    
    def search(
        self,
        query_text: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
        allow_all: bool = False
    ) -> List[ProductEntity]:
        results = self.search_by_text(query_text, top_k=top_k, filters=filters, allow_all=allow_all)
        return results
    
    def get_by_id(self, product_id: str) -> Optional[ProductEntity]:
        for product in self.products:
            if product.id == product_id:
                return product
        return None
    
    def update_product(self, product: ProductEntity) -> None:
        existing_index = next((i for i, p in enumerate(self.products) if p.id == product.id), None)
        product.updated_at = datetime.utcnow()
        if existing_index is None:
            self.products.append(product)
        else:
            self.products[existing_index] = product
        self._save_products()
    
    def add_product(self, product: ProductEntity) -> None:
        product.created_at = datetime.utcnow()
        product.updated_at = product.created_at
        existing = self.get_by_id(product.id)
        if existing:
            self.update_product(product)
            return
        self.products.append(product)
        self._save_products()
    
    def delete_product(self, product_id: str) -> None:
        self.products = [p for p in self.products if p.id != product_id]
        self._save_products()
    
    def search_by_text(
        self,
        query_text: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
        allow_all: bool = False
    ) -> List[ProductEntity]:
        filtered = [p for p in self.products if self._match_filters(p, filters)]
        if not filtered:
            return []
        if not query_text:
            sorted_items = sorted(filtered, key=lambda p: p.price)
            return sorted_items if allow_all else sorted_items[: self._limit_top_k(top_k)]
        scored = self._score_products(query_text, filtered)
        sorted_items = sorted(scored, key=lambda x: x[0], reverse=True)
        results = [p for _, p in sorted_items if allow_all or _ > 0]
        if allow_all:
            return results
        return results[: self._limit_top_k(top_k)]

    def _limit_top_k(self, top_k: int) -> int:
        if top_k <= 0:
            return settings.search_top_k
        return min(top_k, 5)

    def _match_filters(self, product: ProductEntity, filters: Optional[Dict[str, Any]]) -> bool:
        if not filters:
            return True
        for key, value in filters.items():
            if key == "price" and isinstance(value, dict):
                if "$gte" in value and product.price < float(value["$gte"]):
                    return False
                if "$lte" in value and product.price > float(value["$lte"]):
                    return False
            else:
                product_value = getattr(product, key, None)
                if product_value is None:
                    return False
                if str(product_value).lower() != str(value).lower():
                    return False
        return True

    def _score_products(self, query_text: str, products: List[ProductEntity]) -> List[tuple]:
        tokens = self._tokenize(query_text)
        query_lower = query_text.lower().strip()
        results = []
        for product in products:
            haystack = f"{product.name} {product.description} {product.category} {product.chain} {product.currency}".lower()
            score = 0
            if query_lower and query_lower in haystack:
                score += 3
            for token in tokens:
                if token and token in haystack:
                    score += 1
            results.append((score, product))
        return results

    def _tokenize(self, text: str) -> List[str]:
        parts = re.findall(r"[a-z0-9]+|[\u4e00-\u9fff]", text.lower())
        return [p for p in parts if p.strip()]
