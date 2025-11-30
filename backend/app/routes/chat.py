"""
Chat endpoint for RAG-powered Q&A on SEC filings
"""
import asyncio
import logging
import re
from datetime import datetime

from fastapi import APIRouter, HTTPException
from openai import OpenAIError
from pydantic import BaseModel

from app.config import (
    EXHIBIT_MAX_COUNT,
    EXHIBIT_FETCH_TIMEOUT,
    MAX_CONVERSATION_HISTORY,
    MIN_WORD_OVERLAP,
    RETRIEVAL_TOP_K,
)
from app.services.exhibit_fetcher import ExhibitFetcher
from app.services.filing_cache import filing_cache
from app.services.filing_fetcher import FilingFetcher
from app.services.llm import answer_question
from app.services.rag import chunk_filing, embed_texts, vector_store

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Common stopwords for text matching (used in element/preview selection)
_STOPWORDS = frozenset({'the', 'a', 'an', 'is', 'was', 'were', 'for', 'of', 'to', 'in', 'and', 'or', 'that', 'this'})

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    filingId: str
    messages: list[ChatMessage]


class Source(BaseModel):
    """A source chunk used to generate the answer."""
    id: str
    preview: str
    elementIndex: int
    score: float


class ChatResponse(BaseModel):
    message: str
    timestamp: str
    sources: list[Source]


async def _append_exhibit_content(filing_id: str, html: str) -> str:
    """
    Fetch exhibit HTML and append to main filing content.
    Failures are logged and skipped - main filing always succeeds.
    """
    source_url = filing_cache.get_source_url(filing_id)
    if not source_url:
        return html
    
    try:
        fetcher = ExhibitFetcher()
        result = await fetcher.fetch_exhibits(source_url)
        if not result or not result.exhibits:
            return html
        
        exhibit_htmls = []
        filing_fetcher = FilingFetcher()
        
        for exhibit in result.exhibits[:EXHIBIT_MAX_COUNT]:
            try:
                ex_html = await asyncio.wait_for(
                    filing_fetcher.fetch(exhibit.url),
                    timeout=EXHIBIT_FETCH_TIMEOUT
                )
                exhibit_htmls.append(ex_html)
                logger.info(f"Fetched exhibit {exhibit.name} for filing {filing_id}")
            except asyncio.TimeoutError:
                logger.warning(f"Timeout fetching exhibit {exhibit.name}")
            except Exception as e:
                logger.warning(f"Failed to fetch exhibit {exhibit.name}: {e}")
        
        if exhibit_htmls:
            return html + "\n".join(exhibit_htmls)
        
    except Exception as e:
        logger.warning(f"Failed to fetch exhibit list for {filing_id}: {e}")
    
    return html


def extract_and_filter_citations(answer: str, top_chunks: list[dict]) -> tuple[str, list[dict]]:
    """
    Parse LLM answer for [n] citations, filter to only cited chunks,
    and renumber citations to be sequential (1, 2, 3...).
    
    Returns (renumbered_answer, filtered_chunks).
    """
    pattern = r'\[(\d+)\]'
    cited_indices = sorted(set(int(m) for m in re.findall(pattern, answer)))
    
    if not cited_indices:
        return answer, []
    
    # Map old indices to new sequential indices
    index_map = {old: new for new, old in enumerate(cited_indices, start=1)}
    
    # Filter chunks (convert 1-based citation to 0-based array index)
    filtered = []
    for old_idx in cited_indices:
        chunk_idx = old_idx - 1
        if 0 <= chunk_idx < len(top_chunks):
            filtered.append(top_chunks[chunk_idx])
    
    # Renumber citations in answer
    def renumber(match):
        old = int(match.group(1))
        new = index_map.get(old)
        return f"[{new}]" if new else match.group(0)
    
    renumbered = re.sub(pattern, renumber, answer)
    
    return renumbered, filtered


def extract_context_before_citation(answer: str, citation_num: int) -> str:
    """Extract ~100 chars before [citation_num] marker for element matching."""
    pattern = rf'(.{{0,100}})\[{citation_num}\]'
    match = re.search(pattern, answer)
    if match:
        return match.group(1).strip()
    return ""


def pick_best_element_index(chunk: dict, element_text_map: list[dict], answer_context: str = "") -> int:
    """
    Pick the element_index that best matches the answer context.
    Searches ALL elements in element_text_map, not just pre-computed chunk indices.
    Falls back to chunk's element_index if no good match found.
    """
    fallback_index = chunk["metadata"].get("element_index", 0)
    
    if not element_text_map:
        return fallback_index
    
    # Use answer context if provided, otherwise fall back to preview
    search_text = answer_context if answer_context else chunk["text"][:150]
    search_words = set(search_text.lower().split())
    
    # Remove common stopwords for better matching
    search_words -= _STOPWORDS
    
    if not search_words:
        return fallback_index
    
    best_index = fallback_index
    best_score = 0
    
    # Search ALL elements in element_text_map
    for elem in element_text_map:
        elem_words = set(elem["text"].lower().split()) - _STOPWORDS
        overlap = len(elem_words & search_words)
        
        if overlap < MIN_WORD_OVERLAP:
            continue
        
        # Score by overlap count (more matching words = better)
        if overlap > best_score:
            best_score = overlap
            best_index = elem["index"]
    
    return best_index


def pick_best_preview(chunk_text: str, answer_context: str, preview_length: int = 150) -> str:
    """
    Find the portion of chunk_text most relevant to answer_context.
    Falls back to first preview_length chars if no good match found.
    """
    if not answer_context or len(chunk_text) <= preview_length:
        preview = chunk_text[:preview_length].strip()
        return preview + ("..." if len(chunk_text) > preview_length else "")
    
    # Extract key words from context (ignore common words)
    context_words = set(answer_context.lower().split())
    context_words -= _STOPWORDS
    
    if not context_words:
        preview = chunk_text[:preview_length].strip()
        return preview + "..."
    
    # Slide a window through chunk, score by word overlap
    chunk_lower = chunk_text.lower()
    best_start = 0
    best_score = 0
    
    # Check every 50 chars as window start
    step = 50
    for start in range(0, max(1, len(chunk_text) - preview_length), step):
        window = chunk_lower[start:start + preview_length]
        window_words = set(window.split())
        score = len(context_words & window_words)
        if score > best_score:
            best_score = score
            best_start = start
    
    # If no meaningful match, fall back to start
    if best_score < MIN_WORD_OVERLAP:
        preview = chunk_text[:preview_length].strip()
        return preview + "..."
    
    preview = chunk_text[best_start:best_start + preview_length].strip()
    
    # Add ellipsis indicators
    prefix = "..." if best_start > 0 else ""
    suffix = "..." if best_start + preview_length < len(chunk_text) else ""
    
    return prefix + preview + suffix


@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest):
    """
    Phase 3A: LLM-powered chat with retrieval from SEC filings.
    """
    # Validation
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages array cannot be empty")
    
    if not request.filingId:
        raise HTTPException(status_code=400, detail="Filing ID is required")
    
    last_message = request.messages[-1]
    if last_message.role != "user":
        raise HTTPException(status_code=400, detail="Last message must be from user")
    
    if not last_message.content.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty")
    
    # Ingestion (if needed)
    if not vector_store.has_filing(request.filingId):
        html = filing_cache.get_html(request.filingId)
        if not html:
            raise HTTPException(
                status_code=404,
                detail="Filing not loaded. Please open the filing first via /open-filing."
            )
        
        # Fetch and append exhibit content
        html = await _append_exhibit_content(request.filingId, html)
        
        try:
            chunks, element_text_map = chunk_filing(html)
            chunk_texts = [c["text"] for c in chunks]
            
            vectors = await embed_texts(chunk_texts)
            vector_store.ingest(request.filingId, chunks, vectors, element_text_map)
        except OpenAIError as e:
            logger.error(f"OpenAI embedding failed: {str(e)}")
            raise HTTPException(
                status_code=503,
                detail="Embedding service unavailable. Please try again later."
            )
        except Exception as e:
            logger.error(f"Ingestion failed: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to process filing for chat.")
    
    # Retrieval
    question = request.messages[-1].content
    
    try:
        query_vector = (await embed_texts([question]))[0]
        top_chunks = vector_store.retrieve(
            request.filingId,
            query_vector,
            top_k=RETRIEVAL_TOP_K,
            query_text=question
        )
        
        if not top_chunks:
            logger.warning(f"No chunks retrieved for filing {request.filingId}")
            return ChatResponse(
                message="I couldn't find relevant information in the filing to answer your question.",
                timestamp=datetime.utcnow().isoformat(),
                sources=[]
            )
    except Exception as e:
        logger.error(f"Retrieval failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve information from filing.")
    
    # Answer generation
    recent_history = request.messages[:-1][-MAX_CONVERSATION_HISTORY:]
    
    try:
        answer = await answer_question(
            context_chunks=[c["text"] for c in top_chunks],
            conversation_history=[{"role": m.role, "content": m.content} for m in recent_history],
            question=question
        )
        logger.info(f"Generated answer: {len(answer)} chars")
    except TimeoutError:
        logger.warning("LLM timeout")
        return ChatResponse(
            message="The AI took too long to respond. Please try again.",
            timestamp=datetime.utcnow().isoformat(),
            sources=[]
        )
    except Exception as e:
        logger.error(f"LLM call failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate response. Please try again.")
    
    # Filter to only cited sources and renumber
    filtered_answer, cited_chunks = extract_and_filter_citations(answer, top_chunks)
    
    # Get element_text_map for best index selection
    element_text_map = vector_store.get_element_map(request.filingId)
    
    # Build sources with answer-context-aware element targeting
    sources = []
    for i, chunk in enumerate(cited_chunks):
        context = extract_context_before_citation(filtered_answer, i + 1)
        sources.append(Source(
            id=chunk["id"],
            preview=pick_best_preview(chunk["text"], context),
            elementIndex=pick_best_element_index(chunk, element_text_map, context),
            score=round(chunk["score"], 3)
        ))
    
    return ChatResponse(
        message=filtered_answer,
        timestamp=datetime.utcnow().isoformat(),
        sources=sources
    )
