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
            chunks = chunk_filing(html)
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
            vector_store.ingest(request.filingId, chunks, vectors)
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
    
    # Build sources from retrieved chunks
    sources = [
        Source(
            id=chunk["id"],
            preview=chunk["text"][:100].strip() + ("..." if len(chunk["text"]) > 100 else ""),
            elementIndex=chunk["metadata"].get("element_index", 0),
            score=round(chunk["score"], 3)
        )
        for chunk in top_chunks
    ]
    
    return ChatResponse(
        message=answer,
        timestamp=datetime.utcnow().isoformat(),
        sources=sources
    )
