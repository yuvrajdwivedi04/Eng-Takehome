"use client"

import { useEffect, useRef } from "react"
import { TextSelection } from "@/lib/selection-utils"
import { readTextSelection } from "@/hooks/useTextSelection"

interface FilingContentProps {
  html: string
  onTextSelection?: (data: { selection: TextSelection; bounds: DOMRect; selectedText: string } | null) => void
  onReady?: () => void
}

export function FilingContent({ html, onTextSelection, onReady }: FilingContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Apply innerHTML when html prop changes
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Guard: only write if content is different
    if (el.innerHTML !== html) {
      el.innerHTML = html
    }

    // Signal that DOM is ready for highlights
    onReady?.()
  }, [html, onReady])

  // Attach selection listener scoped to this container
  useEffect(() => {
    const el = containerRef.current
    if (!el || !onTextSelection) return

    const handleMouseUp = () => {
      // Small delay to let browser finalize selection
      setTimeout(() => {
        const data = readTextSelection(el)
        onTextSelection(data)
      }, 10)
    }

    // Handle triple-click for paragraph selection (uses same callback)
    const handleClick = (e: MouseEvent) => {
      if (e.detail >= 2) {
        // Double/triple-click detected - stop propagation to prevent menu dismiss
        // The new selection will replace any existing menu via mouseup handler
        e.stopPropagation()
      }
      if (e.detail === 3) {
        // Triple-click: browser has already selected the paragraph
        // Use same flow as mouseup to trigger selection menu
        setTimeout(() => {
          const data = readTextSelection(el)
          onTextSelection(data)
        }, 10)
      }
    }

    el.addEventListener("mouseup", handleMouseUp)
    el.addEventListener("click", handleClick)
    return () => {
      el.removeEventListener("mouseup", handleMouseUp)
      el.removeEventListener("click", handleClick)
    }
  }, [onTextSelection])

  return (
    <div
      ref={containerRef}
      className="prose prose-slate prose-headings:scroll-mt-20 max-w-none filing-content"
    />
  )
}



