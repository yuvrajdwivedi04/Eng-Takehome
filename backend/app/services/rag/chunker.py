import tiktoken
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)


def chunk_filing(html: str) -> list[dict]:
    """
    Phase 3A: Extract text and chunk. Tables included as plain text.
    Phase 3B will add table-to-markdown conversion.
    """
    soup = BeautifulSoup(html, "html.parser")
    
    # Extract plain text (includes table content as text)
    text = soup.get_text(separator=" ", strip=True)
    
    # Chunk the text
    chunks = chunk_text(text, max_tokens=1000, overlap=200)
    
    return [
        {
            "id": f"chunk-{i}",
            "text": chunk,
            "metadata": {"position": i, "token_count": count_tokens(chunk)}
        }
        for i, chunk in enumerate(chunks)
    ]


def chunk_text(text: str, max_tokens: int = 1000, overlap: int = 200) -> list[str]:
    """Split text into overlapping chunks of ~max_tokens."""
    encoding = tiktoken.encoding_for_model("gpt-4")
    tokens = encoding.encode(text)
    
    chunks = []
    start = 0
    
    while start < len(tokens):
        end = start + max_tokens
        chunk_tokens = tokens[start:end]
        
        # Enforce hard max of 1500 tokens
        if len(chunk_tokens) > 1500:
            chunk_tokens = chunk_tokens[:1500]
            logger.warning(f"Truncated chunk to 1500 tokens")
        
        chunks.append(encoding.decode(chunk_tokens))
        start += max_tokens - overlap
    
    return chunks


def count_tokens(text: str) -> int:
    """Count tokens in text using GPT-4 encoding."""
    encoding = tiktoken.encoding_for_model("gpt-4")
    return len(encoding.encode(text))

