"""
Centralized configuration for LLM and embedding settings.

All values can be overridden via environment variables.
"""

import os

# LLM (Chat Completion)
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4-turbo-preview")
LLM_TEMPERATURE = float(os.environ.get("LLM_TEMPERATURE", "0.2"))
LLM_MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", "800"))
LLM_TIMEOUT_SECONDS = float(os.environ.get("LLM_TIMEOUT_SECONDS", "30.0"))

# Embedding
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")

# Tokenizer (for chunking)
TOKENIZER_MODEL = os.environ.get("TOKENIZER_MODEL", "gpt-4")

# SEC API
SEC_USER_AGENT = "Endex SEC Filing Viewer (compliance@endex.io)"

# Cache capacity (shared across VectorStore, FilingCache, BM25Index)
CACHE_MAX_FILINGS = 50

# Rate Limiting
RATE_LIMIT_FILING_FETCH = os.environ.get("RATE_LIMIT_FILING_FETCH", "10/minute")

