import { API_BASE_URL } from "./constants"

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

/**
 * Generic fetch wrapper with consistent error handling.
 * Default error message is "Failed to send message" for chat endpoints.
 */
async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  fallbackError = "Failed to send message"
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: fallbackError }))
    throw new Error(error.detail || fallbackError)
  }

  return response.json()
}

export async function sendChatMessage(
  filingId: string,
  messages: ChatMessage[]
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/api/chat/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filingId, messages }),
  })
}
