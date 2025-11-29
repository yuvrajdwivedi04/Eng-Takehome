"""
BM25-based keyword search for hybrid retrieval.
Complements semantic search for exact value/term lookups in SEC filings.
"""

import math
import re
from collections import Counter, OrderedDict
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


class BM25Index:
    """
    In-memory BM25 index for keyword search.
    Follows same LRU pattern as VectorStore and FilingCache.
    """
    
    def __init__(self, max_filings: int = 50, k1: float = 1.5, b: float = 0.75):
        self.store: OrderedDict[str, dict] = OrderedDict()
        self.max_filings = max_filings
        self.k1 = k1  # Term frequency saturation
        self.b = b    # Length normalization
    
    def _tokenize(self, text: str) -> List[str]:
        """
        Tokenize text into lowercase terms, preserving financial values.
        Handles numbers with decimals, commas, and currency symbols.
        """
        text = text.lower()
        # Match words, numbers (with decimals/commas), and currency values
        tokens = re.findall(r'\b[\w\$\.,]+\b', text)
        
        normalized = []
        for token in tokens:
            # Clean version without $ and commas (for number matching)
            clean = token.replace('$', '').replace(',', '')
            normalized.append(clean)
            # Keep original if different (allows matching both formats)
            if clean != token:
                normalized.append(token)
        
        return normalized
    
    def _expand_query(self, query: str) -> str:
        """
        Expand query with date format variations for better recall.
        E.g., "December 2023" -> "December 2023 December 31, 2023 12/31/2023"
        """
        expanded = query
        
        # Month name patterns
        month_map = {
            'january': ('01', '31'), 'february': ('02', '28'), 'march': ('03', '31'),
            'april': ('04', '30'), 'may': ('05', '31'), 'june': ('06', '30'),
            'july': ('07', '31'), 'august': ('08', '31'), 'september': ('09', '30'),
            'october': ('10', '31'), 'november': ('11', '30'), 'december': ('12', '31')
        }
        
        # Match "Month YYYY" patterns
        month_year_pattern = r'\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b'
        matches = re.findall(month_year_pattern, query.lower())
        
        for month, year in matches:
            month_num, last_day = month_map[month]
            # Add variations
            variations = [
                f"{month.capitalize()} {last_day}, {year}",  # December 31, 2023
                f"{month_num}/{last_day}/{year}",            # 12/31/2023
                f"{year}-{month_num}-{last_day}",            # 2023-12-31
            ]
            expanded += " " + " ".join(variations)
        
        # Also expand Q1/Q2/Q3/Q4 patterns
        quarter_pattern = r'\bq([1-4])\s+(\d{4})\b'
        quarter_matches = re.findall(quarter_pattern, query.lower())
        
        quarter_months = {
            '1': ['march', 'Mar 31'], '2': ['june', 'Jun 30'],
            '3': ['september', 'Sep 30'], '4': ['december', 'Dec 31']
        }
        
        for quarter, year in quarter_matches:
            month_name, end_date = quarter_months[quarter]
            expanded += f" {month_name} {year} {end_date}, {year}"
        
        return expanded
    
    def ingest(self, filing_id: str, chunks: List[dict]):
        """Index chunks for BM25 search with LRU eviction."""
        if len(self.store) >= self.max_filings:
            oldest = next(iter(self.store))
            del self.store[oldest]
            logger.info(f"Evicted {oldest} from BM25Index (LRU)")
        
        # Build document statistics
        doc_freqs: Counter = Counter()  # How many docs contain each term
        doc_lengths: List[int] = []
        tokenized_docs: List[List[str]] = []
        term_freqs: List[Counter] = []  # Pre-compute term frequencies per doc
        
        for chunk in chunks:
            tokens = self._tokenize(chunk["text"])
            tokenized_docs.append(tokens)
            doc_lengths.append(len(tokens))
            
            # Pre-compute term frequencies for this doc
            tf = Counter(tokens)
            term_freqs.append(tf)
            
            # Count unique terms per doc for IDF
            for term in tf.keys():
                doc_freqs[term] += 1
        
        avg_doc_len = sum(doc_lengths) / max(len(doc_lengths), 1)
        num_docs = len(chunks)
        
        self.store[filing_id] = {
            "chunks": chunks,
            "tokenized_docs": tokenized_docs,
            "term_freqs": term_freqs,
            "doc_freqs": doc_freqs,
            "doc_lengths": doc_lengths,
            "avg_doc_len": avg_doc_len,
            "num_docs": num_docs
        }
        self.store.move_to_end(filing_id)
        logger.debug(f"BM25 indexed {num_docs} chunks for {filing_id}")
    
    def _bm25_score(self, query_tokens: List[str], doc_idx: int, data: dict) -> float:
        """Calculate BM25 score for a single document."""
        doc_len = data["doc_lengths"][doc_idx]
        avg_len = data["avg_doc_len"]
        num_docs = data["num_docs"]
        doc_freqs = data["doc_freqs"]
        term_counts = data["term_freqs"][doc_idx]
        
        score = 0.0
        
        for term in query_tokens:
            if term not in term_counts:
                continue
            
            tf = term_counts[term]
            df = doc_freqs.get(term, 0)
            
            # IDF with smoothing
            idf = math.log((num_docs - df + 0.5) / (df + 0.5) + 1)
            
            # BM25 term score
            numerator = tf * (self.k1 + 1)
            denominator = tf + self.k1 * (1 - self.b + self.b * (doc_len / avg_len))
            
            score += idf * (numerator / denominator)
        
        return score
    
    def score_all(self, filing_id: str, query: str) -> List[float]:
        """
        Score ALL chunks against the query using BM25.
        Returns a list of scores in chunk order (same order as ingested).
        Used for hybrid fusion with semantic scores.
        """
        if filing_id not in self.store:
            return []
        
        data = self.store[filing_id]
        
        # Expand query with date variations
        expanded_query = self._expand_query(query)
        query_tokens = self._tokenize(expanded_query)
        
        if not query_tokens:
            return [0.0] * data["num_docs"]
        
        # Score all documents
        scores = []
        for i in range(data["num_docs"]):
            score = self._bm25_score(query_tokens, i, data)
            scores.append(score)
        
        return scores
    
    def has_filing(self, filing_id: str) -> bool:
        return filing_id in self.store
    
    def evict(self, filing_id: str):
        """Evict a filing from the index."""
        if filing_id in self.store:
            del self.store[filing_id]
            logger.debug(f"Evicted {filing_id} from BM25Index")


# Singleton instance
bm25_index = BM25Index()

