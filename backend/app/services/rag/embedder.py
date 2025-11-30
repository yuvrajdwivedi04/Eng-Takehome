import asyncio
from functools import lru_cache
from openai import OpenAI
import numpy as np
from typing import List


@lru_cache(maxsize=1)
def get_client() -> OpenAI:
    """Lazily initialize OpenAI client on first use."""
    return OpenAI()


async def embed_texts(texts: List[str]) -> List[List[float]]:
    """Embed texts using OpenAI API. Batch up to 100 at a time.
    
    Uses asyncio.to_thread to avoid blocking the event loop.
    """
    if not texts:
        return []
    
    # Batch into groups of 100 (API limit)
    all_embeddings = []
    for i in range(0, len(texts), 100):
        batch = texts[i:i+100]
        response = await asyncio.to_thread(
            get_client().embeddings.create,
            model="text-embedding-3-small",
            input=batch
        )
        embeddings = [item.embedding for item in response.data]
        all_embeddings.extend(embeddings)
    
    return all_embeddings


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    return float(np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2)))

