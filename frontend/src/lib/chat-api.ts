const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  filingId: string
  messages: ChatMessage[]
}

export interface Source {
  id: string
  preview: string
  elementIndex: number
  score: number
}

export interface ChatResponse {
  message: string
  timestamp: string
  sources: Source[]
}

export async function sendChatMessage(
  filingId: string,
  messages: ChatMessage[]
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filingId, messages }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to send message" }))
    throw new Error(error.detail || "Failed to send message")
  }

  return response.json()
}
