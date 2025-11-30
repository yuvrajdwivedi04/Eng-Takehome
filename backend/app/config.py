"""
Centralized configuration for LLM and embedding settings.

All values can be overridden via environment variables.
"""

import os

# LLM (Chat Completion)
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4-turbo")
LLM_TEMPERATURE = float(os.environ.get("LLM_TEMPERATURE", "0.2"))
LLM_MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", "800"))
LLM_TIMEOUT_SECONDS = float(os.environ.get("LLM_TIMEOUT_SECONDS", "30.0"))

# Embedding
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")

# Tokenizer (for chunking)
TOKENIZER_MODEL = os.environ.get("TOKENIZER_MODEL", "gpt-4")

# SEC API
SEC_USER_AGENT = os.environ.get(
    "SEC_USER_AGENT",
    "Endex SEC Filing Viewer (compliance@endex.io)"
)

# Cache capacity (shared across VectorStore, FilingCache, BM25Index)
CACHE_MAX_FILINGS = 50

# Rate Limiting
RATE_LIMIT_FILING_FETCH = os.environ.get("RATE_LIMIT_FILING_FETCH", "10/minute")

# Ticker Lookup Cache
TICKER_CACHE_TTL_SECONDS = int(os.environ.get("TICKER_CACHE_TTL_SECONDS", "3600"))

# Exhibit Ingestion
EXHIBIT_MAX_COUNT = int(os.environ.get("EXHIBIT_MAX_COUNT", "10"))
EXHIBIT_FETCH_TIMEOUT = float(os.environ.get("EXHIBIT_FETCH_TIMEOUT", "15.0"))

# Element Indexing Granularity (for citation highlighting precision)
ELEMENT_SPLIT_MIN_LENGTH = int(os.environ.get("ELEMENT_SPLIT_MIN_LENGTH", "300"))
ELEMENT_SPLIT_CHUNK_SIZE = int(os.environ.get("ELEMENT_SPLIT_CHUNK_SIZE", "150"))

# Chat/RAG Tuning
MAX_CONVERSATION_HISTORY = int(os.environ.get("MAX_CONVERSATION_HISTORY", "8"))
CHUNK_HARD_MAX_TOKENS = int(os.environ.get("CHUNK_HARD_MAX_TOKENS", "1500"))
CHUNK_MAX_TOKENS = int(os.environ.get("CHUNK_MAX_TOKENS", "1000"))
CHUNK_OVERLAP_TOKENS = int(os.environ.get("CHUNK_OVERLAP_TOKENS", "200"))
MIN_WORD_OVERLAP = int(os.environ.get("MIN_WORD_OVERLAP", "2"))
RETRIEVAL_TOP_K = int(os.environ.get("RETRIEVAL_TOP_K", "10"))

