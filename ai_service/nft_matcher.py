"""
NFT 语义匹配模块
使用 OpenAI Embedding 对用户查询与订单簿候选做语义匹配，返回最相关的 top_k 订单
"""

import math
from typing import List, Dict, Any, Optional

from openai import OpenAI


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """计算两个向量的余弦相似度"""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _text_for_candidate(candidate: Dict[str, Any]) -> str:
    """从候选订单中提取用于嵌入的文本（名称、描述等）"""
    parts = []
    # orderKey 可作为标识
    order_key = candidate.get("orderKey") or ""
    if order_key:
        parts.append(order_key)
    # metadata 来自 orderbook API: { tokenURI, name }
    metadata = candidate.get("metadata") or {}
    name = metadata.get("name")
    if name:
        parts.append(str(name))
    # 若有 order 信息，可拼接 nft 相关描述
    order = candidate.get("order") or {}
    nft = order.get("nft") or {}
    if nft:
        token_id = nft.get("tokenId")
        if token_id is not None:
            parts.append(f"tokenId {token_id}")
        addr = nft.get("collectionAddr")
        if addr:
            parts.append(addr)
    return " ".join(parts) if parts else order_key or "unknown"


class NFTMatcher:
    """基于 OpenAI Embedding 的 NFT 订单语义匹配器"""

    def __init__(
        self,
        openai_api_key: str,
        embedding_model: str = "text-embedding-3-small",
        min_score: float = 0.3,
    ):
        self.client = OpenAI(api_key=openai_api_key)
        self.embedding_model = embedding_model
        self.min_score = min_score

    def _embed(self, text: str) -> List[float]:
        """单条文本嵌入"""
        if not text.strip():
            return []
        resp = self.client.embeddings.create(
            model=self.embedding_model,
            input=text.strip(),
        )
        return resp.data[0].embedding

    def _embed_batch(self, texts: List[str]) -> List[List[float]]:
        """批量文本嵌入（过滤空字符串）"""
        non_empty = [(i, t.strip()) for i, t in enumerate(texts) if t and t.strip()]
        if not non_empty:
            return [[]] * len(texts)
        indices, valid_texts = zip(*non_empty)
        resp = self.client.embeddings.create(
            model=self.embedding_model,
            input=list(valid_texts),
        )
        # 按原始顺序排列
        by_idx = {indices[j]: resp.data[j].embedding for j in range(len(resp.data))}
        return [by_idx.get(i, []) for i in range(len(texts))]

    async def match_nfts(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        对用户 query 与候选订单做语义匹配，返回得分 >= min_score 的 top_k 条。
        每条结果包含 orderKey、score 以及原始候选信息。
        """
        if not query or not candidates:
            return []

        # 单次查询嵌入
        query_emb = self._embed(query)
        if not query_emb:
            return []

        # 为每个候选生成文本并批量嵌入
        texts = [_text_for_candidate(c) for c in candidates]
        candidate_embs = self._embed_batch(texts)

        # 计算相似度并排序
        scored: List[tuple] = []
        for i, cand in enumerate(candidates):
            emb = candidate_embs[i] if i < len(candidate_embs) else []
            if not emb:
                continue
            score = _cosine_similarity(query_emb, emb)
            if score >= self.min_score:
                scored.append((score, cand))

        scored.sort(key=lambda x: -x[0])
        top = scored[:top_k]

        return [
            {
                "orderKey": t[1].get("orderKey"),
                "score": round(t[0], 4),
                "order": t[1].get("order"),
                "metadata": t[1].get("metadata"),
            }
            for t in top
        ]
