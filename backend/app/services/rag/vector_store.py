from collections import OrderedDict
import numpy as np
import logging
from app.services.filing_cache import filing_cache

logger = logging.getLogger(__name__)


class VectorStore:
    def __init__(self, max_filings: int = 50):
        self.store: OrderedDict[str, dict] = OrderedDict()
        self.max_filings = max_filings
    
    def ingest(self, filing_id: str, chunks: list[dict], vectors: list[list[float]]):
        """Store chunks and vectors with LRU eviction."""
        if len(self.store) >= self.max_filings:
            oldest = next(iter(self.store))
            del self.store[oldest]
            filing_cache.evict(oldest)
            logger.info(f"Evicted {oldest} from VectorStore (LRU)")
        
        self.store[filing_id] = {
            "chunks": chunks,
            "vectors": np.array(vectors)
        }
        self.store.move_to_end(filing_id)
    
    def retrieve(self, filing_id: str, query_vector: list[float], top_k: int = 5) -> list[dict]:
        """Retrieve top K most similar chunks."""
        if filing_id not in self.store:
            return []
        
        data = self.store[filing_id]
        chunks = data["chunks"]
        vectors = data["vectors"]
        
        query = np.array(query_vector)
        similarities = np.dot(vectors, query)
        
        top_indices = np.argsort(similarities)[-top_k:][::-1]
        
        return [
            {**chunks[i], "score": float(similarities[i])}
            for i in top_indices
        ]
    
    def has_filing(self, filing_id: str) -> bool:
        return filing_id in self.store


vector_store = VectorStore()



