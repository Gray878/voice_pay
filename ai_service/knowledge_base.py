"""
商品知识库模块 (Knowledge Base Module)
使用 Pinecone 向量数据库存储和检索 Web3 商品信息
"""

from dataclasses import dataclass
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging

from pinecone import Pinecone, ServerlessSpec

from config import settings
from llm_adapter import llm_adapter


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
            "price": self.price,
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
    负责商品信息的存储、检索和向量搜索
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        index_name: Optional[str] = None,
    ):
        """
        初始化知识库
        
        Args:
            api_key: Pinecone API 密钥
            index_name: Pinecone 索引名称
        """
        self.api_key = api_key or settings.pinecone_api_key
        self.index_name = index_name or settings.pinecone_index_name
        
        # 初始化 Pinecone 客户端
        self.pc = Pinecone(api_key=self.api_key)
        
        # 获取或创建索引
        self._ensure_index_exists()
        self.index = self.pc.Index(self.index_name)
        
        logger.info(f"KnowledgeBase 初始化完成，索引: {self.index_name}")
    
    def _ensure_index_exists(self) -> None:
        """确保 Pinecone 索引存在，不存在则创建"""
        existing_indexes = [index.name for index in self.pc.list_indexes()]
        
        if self.index_name not in existing_indexes:
            logger.info(f"创建 Pinecone 索引: {self.index_name}")
            
            # 根据 LLM Provider 确定向量维度
            if settings.llm_provider == "zhipu":
                dimension = 1024  # 智谱 AI embedding-2 维度
            else:
                dimension = 3072  # OpenAI text-embedding-3-large 维度
            
            self.pc.create_index(
                name=self.index_name,
                dimension=dimension,
                metric="cosine",
                spec=ServerlessSpec(
                    cloud="aws",
                    region="us-east-1"
                )
            )
            logger.info(f"索引 {self.index_name} 创建成功，维度: {dimension}")
        else:
            logger.info(f"索引 {self.index_name} 已存在")
    
    def generate_embedding(self, text: str) -> List[float]:
        """
        生成文本向量
        
        Args:
            text: 输入文本
            
        Returns:
            向量列表
        """
        try:
            embedding = llm_adapter.generate_embedding(text)
            logger.debug(f"生成向量成功，维度: {len(embedding)}")
            return embedding
        except Exception as e:
            logger.error(f"生成向量失败: {e}")
            raise
    
    def search(
        self,
        query_vector: List[float],
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
        allow_all: bool = False
    ) -> List[ProductEntity]:
        """
        向量相似度搜索
        
        Args:
            query_vector: 查询向量
            top_k: 返回结果数量（最多 5 个）
            filters: 元数据过滤条件，例如 {"chain": "polygon", "price": {"$lte": 100}}
            
        Returns:
            商品实体列表
        """
        try:
            if allow_all:
                total_count = self._get_total_vector_count()
                if total_count:
                    top_k = max(top_k or 0, total_count)
            else:
                top_k = min(top_k, 5)
            
            # 执行向量搜索
            results = self.index.query(
                vector=query_vector,
                top_k=top_k,
                filter=filters,
                include_metadata=True
            )
            
            # 转换结果为 ProductEntity
            products = []
            for match in results.matches:
                metadata = match.metadata
                product = ProductEntity(
                    id=match.id,
                    name=metadata.get("name", ""),
                    description=metadata.get("description", ""),
                    category=metadata.get("category", ""),
                    price=float(metadata.get("price", 0)),
                    currency=metadata.get("currency", ""),
                    chain=metadata.get("chain", ""),
                    contract_address=metadata.get("contract_address", ""),
                    token_id=metadata.get("token_id"),
                    metadata=metadata.get("metadata"),
                )
                products.append(product)
            
            logger.info(f"搜索完成，返回 {len(products)} 个结果")
            return products
            
        except Exception as e:
            logger.error(f"向量搜索失败: {e}")
            raise

    def _get_total_vector_count(self) -> int:
        stats = self.index.describe_index_stats()
        total_count = None
        if isinstance(stats, dict):
            total_count = stats.get("total_vector_count")
        else:
            total_count = getattr(stats, "total_vector_count", None)
        if total_count is None:
            return 0
        return int(total_count)
    
    def get_by_id(self, product_id: str) -> Optional[ProductEntity]:
        """
        根据 ID 获取商品
        
        Args:
            product_id: 商品 ID
            
        Returns:
            商品实体，不存在则返回 None
        """
        try:
            result = self.index.fetch(ids=[product_id])
            
            if not result.vectors or product_id not in result.vectors:
                logger.warning(f"商品 {product_id} 不存在")
                return None
            
            vector_data = result.vectors[product_id]
            metadata = vector_data.metadata
            
            product = ProductEntity(
                id=product_id,
                name=metadata.get("name", ""),
                description=metadata.get("description", ""),
                category=metadata.get("category", ""),
                price=float(metadata.get("price", 0)),
                currency=metadata.get("currency", ""),
                chain=metadata.get("chain", ""),
                contract_address=metadata.get("contract_address", ""),
                token_id=metadata.get("token_id"),
                metadata=metadata.get("metadata"),
                embedding=vector_data.values,
            )
            
            logger.info(f"获取商品 {product_id} 成功")
            return product
            
        except Exception as e:
            logger.error(f"获取商品失败: {e}")
            raise
    
    def update_product(self, product: ProductEntity) -> None:
        """
        更新商品信息
        
        Args:
            product: 商品实体
        """
        try:
            # 如果没有向量，生成向量
            if not product.embedding:
                text = f"{product.name} {product.description}"
                product.embedding = self.generate_embedding(text)
            
            # 更新时间戳
            product.updated_at = datetime.utcnow()
            
            # 准备元数据（移除空字典和 None 值）
            metadata = {
                "name": product.name,
                "description": product.description,
                "category": product.category,
                "price": product.price,
                "currency": product.currency,
                "chain": product.chain,
                "contract_address": product.contract_address,
                "updated_at": product.updated_at.isoformat(),
            }
            
            # 只添加非空的可选字段
            if product.token_id:
                metadata["token_id"] = product.token_id
            
            # 更新到 Pinecone
            self.index.upsert(
                vectors=[
                    {
                        "id": product.id,
                        "values": product.embedding,
                        "metadata": metadata,
                    }
                ]
            )
            
            logger.info(f"更新商品 {product.id} 成功")
            
        except Exception as e:
            logger.error(f"更新商品失败: {e}")
            raise
    
    def add_product(self, product: ProductEntity) -> None:
        """
        添加新商品
        
        Args:
            product: 商品实体
        """
        try:
            # 生成向量
            if not product.embedding:
                text = f"{product.name} {product.description}"
                product.embedding = self.generate_embedding(text)
            
            # 设置时间戳
            product.created_at = datetime.utcnow()
            product.updated_at = product.created_at
            
            # 准备元数据（移除空字典和 None 值）
            metadata = {
                "name": product.name,
                "description": product.description,
                "category": product.category,
                "price": product.price,
                "currency": product.currency,
                "chain": product.chain,
                "contract_address": product.contract_address,
                "created_at": product.created_at.isoformat(),
                "updated_at": product.updated_at.isoformat(),
            }
            
            # 只添加非空的可选字段
            if product.token_id:
                metadata["token_id"] = product.token_id
            
            # 添加到 Pinecone
            self.index.upsert(
                vectors=[
                    {
                        "id": product.id,
                        "values": product.embedding,
                        "metadata": metadata,
                    }
                ]
            )
            
            logger.info(f"添加商品 {product.id} 成功")
            
        except Exception as e:
            logger.error(f"添加商品失败: {e}")
            raise
    
    def delete_product(self, product_id: str) -> None:
        """
        删除商品
        
        Args:
            product_id: 商品 ID
        """
        try:
            self.index.delete(ids=[product_id])
            logger.info(f"删除商品 {product_id} 成功")
        except Exception as e:
            logger.error(f"删除商品失败: {e}")
            raise
    
    def search_by_text(
        self,
        query_text: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
        allow_all: bool = False
    ) -> List[ProductEntity]:
        """
        文本语义搜索（便捷方法）
        
        Args:
            query_text: 查询文本
            top_k: 返回结果数量
            filters: 元数据过滤条件
            
        Returns:
            商品实体列表
        """
        query_vector = self.generate_embedding(query_text)
        return self.search(query_vector, top_k, filters, allow_all)
