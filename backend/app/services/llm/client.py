from functools import lru_cache
from openai import OpenAI
import asyncio
from typing import List, Dict
from .prompts import ANSWER_PROMPT


@lru_cache(maxsize=1)
def get_client() -> OpenAI:
    """Lazily initialize OpenAI client on first use."""
    return OpenAI()


async def answer_question(
    context_chunks: List[str],
    conversation_history: List[Dict[str, str]],
    question: str
) -> str:
    """Generate answer using GPT-4 with context and conversation history."""
    
    # Format context
    context = "\n\n".join([
        f"[Excerpt {i+1}]:\n{chunk}"
        for i, chunk in enumerate(context_chunks)
    ])
    
    # Format conversation
    conv_text = "\n".join([
        f"{msg['role'].title()}: {msg['content']}"
        for msg in conversation_history
    ]) if conversation_history else "None"
    
    # Build messages
    messages = [
        {"role": "system", "content": ANSWER_PROMPT},
        {"role": "user", "content": f"SEC Filing Excerpts:\n{context}\n\nConversation History:\n{conv_text}\n\nQuestion: {question}"}
    ]
    
    # Call with timeout
    try:
        response = await asyncio.wait_for(
            asyncio.to_thread(
                get_client().chat.completions.create,
                model="gpt-4-turbo-preview",
                messages=messages,
                temperature=0.2,
                max_tokens=800
            ),
            timeout=30.0
        )
        return response.choices[0].message.content
    except asyncio.TimeoutError:
        raise TimeoutError("LLM call exceeded 30 second timeout")

