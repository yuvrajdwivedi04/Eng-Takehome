from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/chat", tags=["chat"])


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
    Phase 2: Returns a placeholder response.
    Phase 3: Will integrate with LLM to answer questions about the filing.
    
    The endpoint now receives conversation history to support multi-turn chat.
    In Phase 3, this history will be passed to the LLM for context.
    """
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages array cannot be empty")
    
    if not request.filingId:
        raise HTTPException(status_code=400, detail="Filing ID is required")
    
    last_message = request.messages[-1]
    if last_message.role != "user":
        raise HTTPException(status_code=400, detail="Last message must be from user")
    
    if not last_message.content.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty")
    
    return ChatResponse(
        message="I'm a placeholder assistant. The AI model is not connected yet. In Phase 3, I will use the conversation history to provide context-aware answers about the SEC filing.",
        timestamp=datetime.utcnow().isoformat()
    )
