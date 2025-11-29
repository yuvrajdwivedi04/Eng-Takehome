"use client"

import { useEffect, useRef } from "react"
import { TextSelection } from "@/lib/selection-utils"
import { readTextSelection } from "@/hooks/useTextSelection"

interface FilingContentProps {
  html: string
  onTextSelection?: (data: { selection: TextSelection; bounds: DOMRect } | null) => void
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

    el.addEventListener("mouseup", handleMouseUp)
    return () => {
      el.removeEventListener("mouseup", handleMouseUp)
    }
  }, [onTextSelection])

  return (
    <div
      ref={containerRef}
      className="prose prose-slate prose-headings:scroll-mt-20 max-w-none filing-content"
    />
  )
}



