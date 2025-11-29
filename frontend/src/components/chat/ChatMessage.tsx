import { ChatMessage as ChatMessageType } from "./types"
import { cn } from "@/lib/utils"

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isError = message.status === 'error'
  const isSending = message.status === 'sending'

  return (
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted",
          isError && "border-2 border-destructive"
        )}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs opacity-70">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          {isSending && (
            <span className="text-xs opacity-70">Sending...</span>
          )}
          {isError && (
            <span className="text-xs text-destructive">Failed to send</span>
          )}
        </div>
      </div>
    </div>
  )
}



