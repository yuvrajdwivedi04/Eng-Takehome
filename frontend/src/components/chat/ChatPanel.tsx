import { useState, useEffect, useRef } from "react"
import { ChatMessage as ChatMessageType } from "./types"
import { ChatMessage } from "./ChatMessage"
import { ChatInput } from "./ChatInput"
import { ThinkingIndicator } from "./ThinkingIndicator"
import { sendChatMessage } from "@/lib/chat-api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { TextSelection } from "@/lib/selection-utils"

interface ChatPanelProps {
  filingId: string
  filingUrl: string
  isOpen: boolean
  messages: ChatMessageType[]
  onMessagesChange: (messages: ChatMessageType[]) => void
  onClose: () => void
  onSourceClick?: (elementIndex: number) => void
  onConfirmSelection?: (selection: TextSelection) => void
  onHighlightSaved?: () => void
}

const PANEL_WIDTH = 480

export function ChatPanel({ filingId, filingUrl, isOpen, messages, onMessagesChange, onClose, onSourceClick, onConfirmSelection, onHighlightSaved }: ChatPanelProps) {
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

      const assistantMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(response.timestamp),
        status: 'sent',
        sources: response.sources
      }

      // Update user message status and add assistant message
      const finalMessages = updatedMessages.map((msg) =>
        msg.id === userMessage.id
          ? { ...msg, status: 'sent' as const }
          : msg
      )
      onMessagesChange([...finalMessages, assistantMessage])
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

  return (
    <div 
      className="h-full overflow-hidden transition-all duration-300 ease-in-out"
      style={{ width: isOpen ? PANEL_WIDTH : 0 }}
    >
      <aside 
        className="border-l border-white/10 bg-dark h-full flex flex-col text-white relative z-20 shadow-[-4px_0_24px_rgba(0,0,0,0.25)]"
        style={{ width: PANEL_WIDTH }}
      >
        <div className="border-b border-white/10 p-4 flex items-start justify-between">
          <div>
            <h2 className="font-semibold">Ask Questions</h2>
            <p className="text-sm text-gray-400 mt-1">
              Chat about this SEC filing
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-white/10 -mt-1 -mr-2 h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <h3 className="font-medium text-lg mb-2">Start a conversation</h3>
              <p className="text-sm text-gray-400 max-w-sm">
                Ask questions about this SEC filing and get instant answers.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((message) => (
                <ChatMessage 
                  key={message.id} 
                  message={message}
                  filingId={filingId}
                  filingUrl={filingUrl}
                  onSourceClick={onSourceClick}
                  onConfirmSelection={onConfirmSelection}
                  onHighlightSaved={onHighlightSaved}
                />
              ))}
              {isLoading && <ThinkingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <ChatInput onSend={handleSend} disabled={isLoading} />
      </aside>
    </div>
  )
}

