from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import logging
from openai import OpenAIError

from app.services.filing_cache import filing_cache
from app.services.rag import VectorStore, chunk_filing, embed_texts
from app.services.llm import answer_question

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])
vector_store = VectorStore(max_filings=50)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    filingId: str
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    message: str
    timestamp: str


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
        logger.info(f"Ingesting filing {request.filingId}")
        
        html = filing_cache.get_html(request.filingId)
        if not html:
            raise HTTPException(
                status_code=404,
                detail="Filing not loaded. Please open the filing first via /open-filing."
            )
        
        try:
            chunks = chunk_filing(html)
            chunk_texts = [c["text"] for c in chunks]
            vectors = embed_texts(chunk_texts)
            vector_store.ingest(request.filingId, chunks, vectors)
            logger.info(f"Ingested {len(chunks)} chunks for filing {request.filingId}")
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
        query_vector = embed_texts([question])[0]
        top_chunks = vector_store.retrieve(request.filingId, query_vector, top_k=5)
        
        if not top_chunks:
            logger.warning(f"No chunks retrieved for filing {request.filingId}")
            return ChatResponse(
                message="I couldn't find relevant information in the filing to answer your question.",
                timestamp=datetime.utcnow().isoformat()
            )
        
        logger.debug(f"Retrieved {len(top_chunks)} chunks, top score: {top_chunks[0]['score']:.3f}")
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
            timestamp=datetime.utcnow().isoformat()
        )
    except Exception as e:
        logger.error(f"LLM call failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate response. Please try again.")
    
    return ChatResponse(message=answer, timestamp=datetime.utcnow().isoformat())
