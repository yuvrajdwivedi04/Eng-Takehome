"""
Filing chunker for RAG ingestion

Extracts tables, converts to LLM-optimized format, chunks with overlap
"""
import tiktoken
from bs4 import BeautifulSoup
import logging

from app.config import (
    TOKENIZER_MODEL,
    CHUNK_HARD_MAX_TOKENS,
    CHUNK_MAX_TOKENS,
    CHUNK_OVERLAP_TOKENS,
    MIN_WORD_OVERLAP,
)
from app.utils.sanitize_html import sanitize
from app.services.rag.table_formatter import format_table_for_llm

logger = logging.getLogger(__name__)


def extract_cell_text(cell) -> str:
    """Extract clean text from table cell, handling nested HTML."""
    text = cell.get_text(separator=" ", strip=True)
    return " ".join(text.split())


def extract_tables(soup: BeautifulSoup) -> list[dict]:
    """Extract all tables and convert to LLM-optimized format with error handling."""
    tables = []
    table_elements = soup.find_all("table")
    
    for i, table_elem in enumerate(table_elements):
        try:
            # Use LLM-optimized formatter (handles both financial and general tables)
            formatted = format_table_for_llm(table_elem)
            
            if formatted:  # Skip empty tables
                tables.append({
                    "markdown": formatted,  # Key name kept for compatibility
                    "index": i,
                    "is_split": False
                })
        except Exception as e:
            logger.warning(f"Failed to convert table {i}: {str(e)}")
            # Continue with next table - don't crash entire process
    
    return tables


def chunk_filing(html: str) -> tuple[list[dict], list[dict]]:
    """
    Phase 3B: Extract tables, convert to markdown, chunk with structure preserved.
    Captures element indices from data-element-index attributes for source linking.
    """
    # Sanitize on-the-fly to get element indices (sanitized HTML has data-element-index)
    sanitized_html = sanitize(html)
    sanitized_soup = BeautifulSoup(sanitized_html, "html.parser")
    
    # Build element_text_map from SANITIZED html (has data-element-index attrs)
    element_text_map = []
    for tag in sanitized_soup.find_all(attrs={"data-element-index": True}):
        text_content = tag.get_text(separator=" ", strip=True)
        if text_content:
            # Check if element is inside a table
            is_table_cell = tag.name in ('td', 'th') or tag.find_parent('table') is not None
            element_text_map.append({
                "index": int(tag["data-element-index"]),
                "text": text_content,  # Full text, not truncated
                "is_table_cell": is_table_cell
            })
    
    # Use sanitized HTML for chunking (removes hidden content, scripts, styles)
    soup = sanitized_soup
    
    # Extract and convert tables to markdown
    tables = extract_tables(soup)
    
    # Replace tables with placeholders in HTML
    for i, table_elem in enumerate(soup.find_all("table")):
        placeholder = f"[TABLE_{i}_PLACEHOLDER]"
        table_elem.replace_with(placeholder)
    
    # Extract text (now with placeholders instead of table HTML)
    text = soup.get_text(separator=" ", strip=True)
    
    # Group split tables by index and join them
    tables_by_index = {}
    for table_data in tables:
        idx = table_data["index"]
        if idx not in tables_by_index:
            tables_by_index[idx] = []
        tables_by_index[idx].append(table_data["markdown"])
    
    # Reinsert markdown tables at placeholder positions
    for idx, markdown_parts in tables_by_index.items():
        placeholder = f"[TABLE_{idx}_PLACEHOLDER]"
        combined_markdown = "\n\n".join(markdown_parts)
        text = text.replace(placeholder, f"\n\n{combined_markdown}\n\n", 1)
    
    # Chunk the combined text (with markdown tables)
    chunks = chunk_text(text, max_tokens=CHUNK_MAX_TOKENS, overlap=CHUNK_OVERLAP_TOKENS)
    
    # Return chunks with metadata including element_indices
    result = []
    for i, chunk in enumerate(chunks):
        # Find all matching element indices for this chunk
        element_indices = find_element_indices_for_chunk(chunk, element_text_map)
        
        # Detect table content (both markdown "|" and new row-by-row "•" format)
        has_table = "| " in chunk or "  •" in chunk
        
        result.append({
            "id": f"chunk-{i}",
            "text": chunk,
            "metadata": {
                "position": i,
                "token_count": count_tokens(chunk),
                "has_table": has_table,
                "element_index": element_indices[0],  # Backwards compatible
                "element_indices": element_indices     # All spanned elements
            }
        })
    
    return result, element_text_map


def find_element_indices_for_chunk(chunk_text: str, element_text_map: list[dict]) -> list[int]:
    """
    Find ALL element indices whose text overlaps with this chunk.
    Returns list sorted by overlap score (best first), capped at 15 indices.
    """
    if not element_text_map:
        return [0]
    
    chunk_lower = chunk_text.lower()
    chunk_words = set(chunk_lower.split())
    
    matches = []
    for elem in element_text_map:
        elem_text = elem["text"].lower()
        elem_words = set(elem_text.split())
        overlap = len(elem_words & chunk_words)
        
        if overlap < MIN_WORD_OVERLAP:
            continue
        
        # Score: proportion of element words found in chunk
        score = overlap / max(len(elem_words), 1)
        matches.append({"index": elem["index"], "score": score})
    
    # Sort by score descending, cap at 15 indices
    matches.sort(key=lambda x: x["score"], reverse=True)
    indices = [m["index"] for m in matches[:15]]
    
    return indices if indices else [0]


def chunk_text(text: str, max_tokens: int = 1000, overlap: int = 200) -> list[str]:
    """Split text into overlapping chunks of ~max_tokens."""
    encoding = tiktoken.encoding_for_model(TOKENIZER_MODEL)
    tokens = encoding.encode(text)
    
    chunks = []
    start = 0
    
    while start < len(tokens):
        end = start + max_tokens
        chunk_tokens = tokens[start:end]
        
        # Enforce hard max token limit
        if len(chunk_tokens) > CHUNK_HARD_MAX_TOKENS:
            chunk_tokens = chunk_tokens[:CHUNK_HARD_MAX_TOKENS]
            logger.warning(f"Truncated chunk to {CHUNK_HARD_MAX_TOKENS} tokens")
        
        chunks.append(encoding.decode(chunk_tokens))
        start += max_tokens - overlap
    
    return chunks


def count_tokens(text: str) -> int:
    """Count tokens in text using tiktoken encoding."""
    encoding = tiktoken.encoding_for_model(TOKENIZER_MODEL)
    return len(encoding.encode(text))

