import { ChatMessage as ChatMessageType } from "./types"
import { SourcesList } from "./SourcesList"
import { CitationBadge } from "./CitationBadge"
import { parseCitations, getSourceByCitation } from "@/lib/citation-parser"
import { cn } from "@/lib/utils"
import { TextSelection } from "@/lib/selection-utils"

interface ChatMessageProps {
  message: ChatMessageType
  filingId: string
  filingUrl: string
  onSourceClick?: (elementIndex: number) => void
  onConfirmSelection?: (selection: TextSelection) => void
  onHighlightSaved?: () => void
}

export function ChatMessage({ message, filingId, filingUrl, onSourceClick, onConfirmSelection, onHighlightSaved }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isError = message.status === 'error'
  const isSending = message.status === 'sending'
  const isAssistant = message.role === 'assistant'
  const hasSources = isAssistant && message.sources && message.sources.length > 0

  // Only parse citations when message is complete to prevent flicker during streaming
  const isMessageComplete = message.status === 'sent' || message.status === 'error'
  const shouldRenderCitations = isAssistant && hasSources && isMessageComplete && onSourceClick

  return (
    <div className={cn(
      "flex w-full mb-4",
      isUser ? "justify-end" : "justify-start",
      isAssistant && "message-fade-in"
    )}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2",
          isAssistant 
            ? "bg-brand-teal/10 text-white border border-brand-teal/20"
            : isUser
            ? "bg-white/10 text-white"
            : "bg-muted",
          isError && "border-2 border-destructive"
        )}
      >
        {shouldRenderCitations ? (
          <p className="text-sm whitespace-pre-wrap break-words">
            {parseCitations(message.content).map((segment, i) =>
              segment.type === "citation" ? (
                <CitationBadge
                  key={i}
                  index={segment.citationIndex!}
                  source={getSourceByCitation(segment.citationIndex!, message.sources!)}
                  filingUrl={filingUrl}
                  onSourceClick={onSourceClick!}
                />
              ) : (
                <span key={i}>{segment.content}</span>
              )
            )}
          </p>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        )}
        
        {hasSources && onSourceClick && (
          <SourcesList 
            sources={message.sources!}
            filingId={filingId}
            filingUrl={filingUrl}
            onSourceClick={onSourceClick}
            onConfirmSelection={onConfirmSelection}
            onHighlightSaved={onHighlightSaved}
          />
        )}
        
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



