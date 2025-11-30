"use client"

import { useState } from "react"
import { Source } from "@/lib/chat-api"
import { FileText, Link2, Check } from "lucide-react"
import { getShareableUrl, TextSelection } from "@/lib/selection-utils"
import { createHighlight, saveHighlight } from "@/lib/highlights"

interface SourceCardProps {
  source: Source
  index: number
  filingId: string
  filingUrl: string
  onClick: (elementIndex: number) => void
  onConfirmSelection?: (selection: TextSelection) => void
  onHighlightSaved?: () => void
}

export function SourceCard({ source, index, filingId, filingUrl, onClick, onConfirmSelection, onHighlightSaved }: SourceCardProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Get actual element text length for proper highlighting
    const element = document.querySelector(`[data-element-index="${source.elementIndex}"]`)
    const textLength = element?.textContent?.length || 100
    
    const selection: TextSelection = {
      type: "text",
      elementIndex: source.elementIndex,
      startOffset: 0,
      endOffset: textLength,
    }

    // Confirm selection for persistent highlight
    onConfirmSelection?.(selection)

    // Save to highlights
    const highlight = createHighlight(filingId, filingUrl, selection, source.preview)
    saveHighlight(highlight)
    onHighlightSaved?.()

    // Copy shareable URL
    const url = getShareableUrl(filingUrl, selection)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  return (
    <div className="w-full p-3 rounded-md border border-white/10 hover:border-brand-teal/50 hover:bg-white/5 transition-all group">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-5 h-5 rounded bg-brand-teal/20 text-brand-teal flex items-center justify-center text-xs font-medium">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-300 line-clamp-2 group-hover:text-white transition-colors">
            {source.preview}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => onClick(source.elementIndex)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-teal transition-colors"
            >
              <FileText className="w-3 h-3" />
              View in document
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-teal transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-brand-teal" />
                  <span className="text-brand-teal">Copied!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3 h-3" />
                  Share link
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

