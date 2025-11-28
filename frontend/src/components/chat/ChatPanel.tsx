import { useState, useEffect, useRef, useCallback } from "react"
import { ChatMessage as ChatMessageType } from "./types"
import { ChatMessage } from "./ChatMessage"
import { ChatInput } from "./ChatInput"
import { ResizeHandle } from "./ResizeHandle"
import { sendChatMessage } from "@/lib/chat-api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquare } from "lucide-react"

interface ChatPanelProps {
  filingId: string
  isOpen: boolean
  messages: ChatMessageType[]
  onMessagesChange: (messages: ChatMessageType[]) => void
}

const MIN_WIDTH = 320
const MAX_WIDTH = 600
const DEFAULT_WIDTH = 384

export function ChatPanel({ filingId, isOpen, messages, onMessagesChange }: ChatPanelProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleResize = useCallback((deltaX: number) => {
    setWidth((prev) => {
      const newWidth = prev + deltaX
      return Math.min(Math.max(newWidth, MIN_WIDTH), MAX_WIDTH)
    })
  }, [])

  const handleSend = async (content: string) => {
    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
      status: 'sending'
    }

    const updatedMessages = [...messages, userMessage]
    onMessagesChange(updatedMessages)
    setIsLoading(true)

    try {
      const apiMessages = updatedMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
      
      const response = await sendChatMessage(filingId, apiMessages)
      
      onMessagesChange(
        updatedMessages.map((msg) =>
          msg.id === userMessage.id
            ? { ...msg, status: 'sent' as const }
            : msg
        )
      )

      const assistantMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(response.timestamp),
        status: 'sent'
      }

      onMessagesChange([...updatedMessages, assistantMessage])
    } catch (error) {
      onMessagesChange(
        updatedMessages.map((msg) =>
          msg.id === userMessage.id
            ? { ...msg, status: 'error' as const }
            : msg
        )
      )
      console.error('Failed to send message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <aside className="border-l bg-background h-full flex flex-col relative" style={{ width: `${width}px` }}>
      <ResizeHandle onResize={handleResize} />
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Ask Questions</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Chat about this SEC filing
        </p>
      </div>

      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-2">Start a conversation</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Ask questions about this SEC filing and get instant answers.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <ChatInput onSend={handleSend} disabled={isLoading} />
    </aside>
  )
}

