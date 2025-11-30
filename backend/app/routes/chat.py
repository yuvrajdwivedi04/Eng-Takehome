from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import logging
from openai import OpenAIError

from app.services.filing_cache import filing_cache
from app.services.rag import VectorStore, chunk_filing, embed_texts
from app.services.llm import answer_question

# Configure logging to show INFO level
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

router = APIRouter(prefix="/api/chat", tags=["chat"])
vector_store = VectorStore(max_filings=50)


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


import re

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
    
    logger.debug(f"Citations: {cited_indices} -> filtered to {len(filtered)} sources")
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
    Falls back to preview-based matching if no context provided.
    """
    indices = chunk["metadata"].get("element_indices", [])
    if not indices:
        return chunk["metadata"].get("element_index", 0)
    
    if len(indices) == 1 or not element_text_map:
        return indices[0]
    
    # Use answer context if provided, otherwise fall back to preview
    search_text = answer_context if answer_context else chunk["text"][:150]
    search_words = set(search_text.lower().split())
    
    best_index = indices[0]
    best_score = 0
    
    for idx in indices:
        elem = next((e for e in element_text_map if e["index"] == idx), None)
        if not elem:
            continue
        elem_words = set(elem["text"].lower().split())
        score = len(elem_words & search_words)
        if score > best_score:
            best_score = score
            best_index = idx
    
    return best_index


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
        logger.info(f"[DEBUG] Ingesting filing {request.filingId}")
        
        html = filing_cache.get_html(request.filingId)
        if not html:
            raise HTTPException(
                status_code=404,
                detail="Filing not loaded. Please open the filing first via /open-filing."
            )
        
        try:
            chunks, element_text_map = chunk_filing(html)
            chunk_texts = [c["text"] for c in chunks]
            
            # DEBUG: Log chunk statistics
            table_chunks = [c for c in chunks if c["metadata"].get("has_table")]
            logger.info(f"[DEBUG] Created {len(chunks)} total chunks, {len(table_chunks)} contain tables")
            
            # DEBUG: Search for "comprehensive income" in all chunks
            search_term = "comprehensive income"
            matching_chunks = []
            for i, chunk in enumerate(chunks):
                if search_term.lower() in chunk["text"].lower():
                    matching_chunks.append(i)
            logger.info(f"[DEBUG] Chunks containing '{search_term}': {matching_chunks}")
            
            # DEBUG: Log first few chunks with tables
            for i, chunk in enumerate(chunks[:3]):
                has_table = "YES" if chunk["metadata"].get("has_table") else "NO"
                preview = chunk["text"][:200].replace("\n", " ")
                logger.info(f"[DEBUG] Chunk {i} (table={has_table}): {preview}...")
            
            vectors = embed_texts(chunk_texts)
            vector_store.ingest(request.filingId, chunks, vectors, element_text_map)
            logger.info(f"[DEBUG] Ingested {len(chunks)} chunks for filing {request.filingId}")
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
    logger.info(f"[DEBUG] Question: {question}")
    
    try:
        query_vector = embed_texts([question])[0]
        top_chunks = vector_store.retrieve(
            request.filingId,
            query_vector,
            top_k=10,
            query_text=question
        )
        
        if not top_chunks:
            logger.warning(f"No chunks retrieved for filing {request.filingId}")
            return ChatResponse(
                message="I couldn't find relevant information in the filing to answer your question.",
                timestamp=datetime.utcnow().isoformat(),
                sources=[]
            )
        
        # DEBUG: Log each retrieved chunk with details (now with hybrid scores)
        logger.info(f"[DEBUG] Retrieved {len(top_chunks)} chunks (hybrid search):")
        for i, chunk in enumerate(top_chunks):
            has_table = "YES" if chunk["metadata"].get("has_table") else "NO"
            score = chunk["score"]
            sem_score = chunk.get("semantic_score", score)
            kw_score = chunk.get("keyword_score", 0)
            preview = chunk["text"][:300].replace("\n", " ")
            logger.info(f"[DEBUG] Chunk {i+1} (combined={score:.3f}, sem={sem_score:.3f}, kw={kw_score:.3f}, table={has_table}): {preview}...")
            
            # Check if this chunk contains "comprehensive income"
            if "comprehensive income" in chunk["text"].lower():
                logger.info(f"[DEBUG] ^^^ This chunk CONTAINS 'comprehensive income'!")
        
        logger.info(f"[DEBUG] Top combined score: {top_chunks[0]['score']:.3f}")
    except Exception as e:
        logger.error(f"Retrieval failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve information from filing.")
    
    # Answer generation
    recent_history = request.messages[:-1][-8:]  # Last 8 messages, handles short lists
    
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
            preview=chunk["text"][:150].strip() + ("..." if len(chunk["text"]) > 150 else ""),
            elementIndex=pick_best_element_index(chunk, element_text_map, context),
            score=round(chunk["score"], 3)
        ))
    
    return ChatResponse(
        message=filtered_answer,
        timestamp=datetime.utcnow().isoformat(),
        sources=sources
    )
