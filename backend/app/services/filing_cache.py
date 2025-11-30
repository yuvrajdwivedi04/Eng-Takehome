"""
LRU cache for SEC filing HTML content.

Provides in-memory storage with automatic eviction of least-recently-used
filings when capacity is reached.
"""

from collections import OrderedDict
from datetime import datetime
import logging

from app.config import CACHE_MAX_FILINGS

logger = logging.getLogger(__name__)


class FilingCache:
    """In-memory LRU cache for SEC filing HTML and metadata."""
    
    def __init__(self, max_filings: int = CACHE_MAX_FILINGS):
        """Initialize cache with specified capacity."""
        self._cache: OrderedDict[str, dict] = OrderedDict()
        self.max_filings = max_filings
    
    def store(self, filing_id: str, html: str, source_url: str):
        """
        Store a filing's HTML content and source URL.
        
        Evicts the least-recently-used entry if cache is at capacity.
        Storing an existing filing_id updates it and marks it as most recent.
        
        Args:
            filing_id: Unique identifier (typically SHA-1 hash of URL)
            html: Raw HTML content of the filing
            source_url: Original SEC EDGAR URL
        """
        if len(self._cache) >= self.max_filings:
            oldest = next(iter(self._cache))
            del self._cache[oldest]
            logger.info(f"Evicted {oldest} from FilingCache (LRU)")
        
        self._cache[filing_id] = {
            "html": html,
            "source_url": source_url,
            "cached_at": datetime.utcnow()
        }
        self._cache.move_to_end(filing_id)
    
    def get_html(self, filing_id: str) -> str | None:
        """Retrieve cached HTML for a filing, or None if not cached."""
        entry = self._cache.get(filing_id)
        if entry:
            self._cache.move_to_end(filing_id)
        return entry["html"] if entry else None
    
    def get_source_url(self, filing_id: str) -> str | None:
        """Retrieve the original SEC filing URL for a cached filing."""
        entry = self._cache.get(filing_id)
        return entry.get("source_url") if entry else None
    
    def has_filing(self, filing_id: str) -> bool:
        """Check whether a filing exists in the cache."""
        return filing_id in self._cache
    
    def evict(self, filing_id: str):
        """Remove a filing from the cache if present."""
        if filing_id in self._cache:
            del self._cache[filing_id]


filing_cache = FilingCache()
