"use client"

import { useState } from "react"
import { Source } from "@/lib/chat-api"
import { getShareableUrl } from "@/lib/selection-utils"
import { Link2, ExternalLink } from "lucide-react"

interface CitationBadgeProps {
  index: number // 1-based citation number
  source?: Source // Matched source (may be undefined if citation invalid)
  filingUrl: string // For generating shareable links
  onSourceClick: (elementIndex: number) => void
}

export function CitationBadge({
  index,
  source,
  filingUrl,
  onSourceClick,
}: CitationBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleClick = () => {
    if (source) {
      onSourceClick(source.elementIndex)
    }
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!source) return

    const selection = {
      type: "text" as const,
      elementIndex: source.elementIndex,
      startOffset: 0,
      endOffset: 100,
    }

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
    <span className="relative inline-block">
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 mx-0.5 text-xs font-medium bg-brand-teal/20 text-brand-teal hover:bg-brand-teal/30 transition-colors cursor-pointer align-baseline"
        aria-label={`Source ${index}`}
      >
        {index}
      </button>

      {/* Tooltip with preview and share */}
      {showTooltip && source && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-dark border border-white/20 shadow-xl animate-fade-in"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <p className="text-xs text-gray-300 line-clamp-3 mb-2">
            {source.preview}
          </p>
          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            <button
              onClick={handleClick}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-brand-teal hover:bg-brand-teal/10 transition-colors rounded"
            >
              <ExternalLink className="w-3 h-3" />
              View
            </button>
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-300 hover:text-brand-teal hover:bg-brand-teal/10 transition-colors rounded"
            >
              <Link2 className="w-3 h-3" />
              {copied ? "Copied!" : "Share"}
            </button>
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-dark" />
        </div>
      )}
    </span>
  )
}

