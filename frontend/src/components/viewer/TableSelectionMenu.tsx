"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { TableSelection, getShareableUrl } from "@/lib/selection-utils"
import { saveHighlight, createHighlight } from "@/lib/highlights"
import { Link2, Check, Copy } from "lucide-react"

interface TableSelectionMenuProps {
  selection: TableSelection
  bounds: DOMRect
  containerRef: React.RefObject<HTMLElement>
  filingId: string
  filingUrl: string
  onDismiss: () => void
  onHighlightSaved?: () => void
}

export function TableSelectionMenu({ 
  selection, bounds, containerRef, filingId, filingUrl, onDismiss, onHighlightSaved 
}: TableSelectionMenuProps) {
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  
  const rows = (selection.endRow ?? 0) - (selection.startRow ?? 0) + 1
  const cols = (selection.endCol ?? 0) - (selection.startCol ?? 0) + 1
  const cellCount = rows * cols
  const shareableUrl = useMemo(() => getShareableUrl(filingUrl, selection), [filingUrl, selection])

  const position = useMemo(() => {
    if (!containerRef.current) return { top: 0, left: 0 }
    const container = containerRef.current
    const containerBounds = container.getBoundingClientRect()
    return {
      top: bounds.bottom - containerBounds.top + container.scrollTop + 8,
      left: bounds.left - containerBounds.left + container.scrollLeft
    }
  }, [bounds, containerRef])

  useEffect(() => {
    // Delay adding click listener to avoid dismissing from the same click that triggered selection
    const timeoutId = setTimeout(() => {
      const handleClick = (e: MouseEvent) => {
        if (menuRef.current?.contains(e.target as Node)) return
        onDismiss()
      }
      document.addEventListener('click', handleClick)
      // Store cleanup in ref so we can clean up properly
      cleanupRef.current = () => document.removeEventListener('click', handleClick)
    }, 100)
    
    return () => {
      clearTimeout(timeoutId)
      cleanupRef.current?.()
    }
  }, [onDismiss])

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(shareableUrl)
      
      // Save highlight to localStorage
      const snippet = `Table selection: ${cellCount} cell${cellCount > 1 ? 's' : ''}`
      const highlight = createHighlight(filingId, filingUrl, selection, snippet)
      saveHighlight(highlight)
      onHighlightSaved?.()
      
      setCopied(true)
      setTimeout(() => { setCopied(false); onDismiss() }, 1500)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  return (
    <div ref={menuRef} className="absolute z-50 bg-white border border-gray-200 shadow-lg animate-fade-in"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}>
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="text-sm text-gray-600">{cellCount} cell{cellCount > 1 ? 's' : ''} selected</span>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link2 className="w-3 h-3" />
          <span>Share</span>
        </div>
        <button onClick={handleCopy} className="flex items-center justify-center w-7 h-7 hover:bg-gray-100 transition-colors">
          {copied ? <Check className="w-4 h-4 text-brand-teal" /> : <Copy className="w-4 h-4 text-gray-500" />}
        </button>
      </div>
    </div>
  )
}

