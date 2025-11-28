from collections import OrderedDict
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class FilingCache:
    def __init__(self, max_filings: int = 50):
        self._cache: OrderedDict[str, dict] = OrderedDict()
        self.max_filings = max_filings
    
    def store(self, filing_id: str, html: str, source_url: str):
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
        entry = self._cache.get(filing_id)
        if entry:
            self._cache.move_to_end(filing_id)
        return entry["html"] if entry else None
    
    def has_filing(self, filing_id: str) -> bool:
        return filing_id in self._cache
    
    def evict(self, filing_id: str):
        if filing_id in self._cache:
            del self._cache[filing_id]
            logger.debug(f"Evicted {filing_id} from FilingCache")


filing_cache = FilingCache()

