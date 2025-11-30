"use client"

import { useState } from "react"
import { Source } from "@/lib/chat-api"
import { SourceCard } from "./SourceCard"
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react"
import { TextSelection } from "@/lib/selection-utils"

interface SourcesListProps {
  sources: Source[]
  filingId: string
  filingUrl: string
  onSourceClick: (elementIndex: number) => void
  onConfirmSelection?: (selection: TextSelection) => void
  onHighlightSaved?: () => void
}

export function SourcesList({ sources, filingId, filingUrl, onSourceClick, onConfirmSelection, onHighlightSaved }: SourcesListProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (sources.length === 0) {
    return null
  }

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors w-full"
      >
        <BookOpen className="w-4 h-4" />
        <span>{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 ml-auto" />
        ) : (
          <ChevronDown className="w-4 h-4 ml-auto" />
        )}
      </button>
      
      {isExpanded && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {sources.map((source, index) => (
            <SourceCard
              key={source.id}
              source={source}
              index={index}
              filingId={filingId}
              filingUrl={filingUrl}
              onClick={onSourceClick}
              onConfirmSelection={onConfirmSelection}
              onHighlightSaved={onHighlightSaved}
            />
          ))}
        </div>
      )}
    </div>
  )
}

