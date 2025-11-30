from collections import OrderedDict
from typing import Optional
import numpy as np
import logging
from app.services.filing_cache import filing_cache
from app.services.rag.keyword_index import bm25_index

logger = logging.getLogger(__name__)


def _min_max_normalize(scores: np.ndarray, epsilon: float = 1e-9) -> np.ndarray:
    """Normalize scores to 0-1 range using min-max scaling."""
    min_score = scores.min()
    max_score = scores.max()
    range_score = max_score - min_score + epsilon
    return (scores - min_score) / range_score


class VectorStore:
    def __init__(self, max_filings: int = 50):
        self.store: OrderedDict[str, dict] = OrderedDict()
        self.max_filings = max_filings
    
    def ingest(self, filing_id: str, chunks: list[dict], vectors: list[list[float]], element_text_map: list[dict] = None):
        """Store chunks, vectors, and element_text_map with LRU eviction. Also indexes for BM25."""
        if len(self.store) >= self.max_filings:
            oldest = next(iter(self.store))
            del self.store[oldest]
            filing_cache.evict(oldest)
            bm25_index.evict(oldest)
            logger.info(f"Evicted {oldest} from VectorStore (LRU)")
        
        self.store[filing_id] = {
            "chunks": chunks,
            "vectors": np.array(vectors),
            "element_text_map": element_text_map or []
        }
        self.store.move_to_end(filing_id)
        
        # Also index for BM25 keyword search
        bm25_index.ingest(filing_id, chunks)
    
    def retrieve(
        self,
        filing_id: str,
        query_vector: list[float],
        top_k: int = 10,
        query_text: Optional[str] = None,
        semantic_weight: float = 0.6,
        keyword_weight: float = 0.4
    ) -> list[dict]:
        """
        Retrieve top K chunks using hybrid search (semantic + keyword).
        
        When query_text is provided:
        - Scores ALL chunks with both semantic similarity and BM25
        - Normalizes both score arrays to 0-1 using min-max
        - Fuses scores with configurable weights
        - Returns top_k by combined score
        
        When query_text is None: uses semantic similarity only (backward compatible).
        """
        if filing_id not in self.store:
            return []
        
        data = self.store[filing_id]
        chunks = data["chunks"]
        vectors = data["vectors"]
        
        # Compute semantic scores for ALL chunks
        query = np.array(query_vector)
        semantic_scores = np.dot(vectors, query)
        
        # If no query_text, use semantic only (backward compatible)
        if query_text is None:
            top_indices = np.argsort(semantic_scores)[-top_k:][::-1]
            return [
                {**chunks[i], "score": float(semantic_scores[i])}
                for i in top_indices
            ]
        
        # Hybrid search: get keyword scores for ALL chunks
        keyword_scores = bm25_index.score_all(filing_id, query_text)
        
        if not keyword_scores:
            # Fallback to semantic only if BM25 index not available
            top_indices = np.argsort(semantic_scores)[-top_k:][::-1]
            return [
                {**chunks[i], "score": float(semantic_scores[i])}
                for i in top_indices
            ]
        
        keyword_scores = np.array(keyword_scores)
        
        # Normalize both to 0-1 range
        sem_norm = _min_max_normalize(semantic_scores)
        kw_norm = _min_max_normalize(keyword_scores)
        
        # Fuse scores
        combined_scores = semantic_weight * sem_norm + keyword_weight * kw_norm
        
        # Get top K by combined score
        top_indices = np.argsort(combined_scores)[-top_k:][::-1]
        
        return [
            {
                **chunks[i],
                "score": float(combined_scores[i]),
                "semantic_score": float(semantic_scores[i]),
                "keyword_score": float(keyword_scores[i])
            }
            for i in top_indices
        ]
    
    def has_filing(self, filing_id: str) -> bool:
        return filing_id in self.store
    
    def get_element_map(self, filing_id: str) -> list[dict]:
        """Get element_text_map for a filing, or empty list if not found."""
        if filing_id not in self.store:
            return []
        return self.store[filing_id].get("element_text_map", [])


vector_store = VectorStore()
