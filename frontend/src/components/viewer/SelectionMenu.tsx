"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { TextSelection, getShareableUrl } from "@/lib/selection-utils"
import { saveHighlight, createHighlight } from "@/lib/highlights"
import { Link2, Check, Copy } from "lucide-react"

interface SelectionMenuProps {
  selection: TextSelection
  selectedText: string
  bounds: DOMRect
  containerRef: React.RefObject<HTMLElement>
  filingId: string
  filingUrl: string
  onConfirm: (selection: TextSelection) => void
  onDismiss: () => void
  onHighlightSaved?: () => void
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + "..."
}

function truncateUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname + parsed.search
    if (path.length > 20) {
      return parsed.host + path.slice(0, 15) + "..."
    }
    return parsed.host + path
  } catch {
    return url.slice(0, 30) + "..."
  }
}

export function SelectionMenu({ 
  selection, 
  selectedText,
  bounds, 
  containerRef, 
  filingId,
  filingUrl, 
  onConfirm, 
  onDismiss,
  onHighlightSaved
}: SelectionMenuProps) {
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const shareableUrl = useMemo(() => getShareableUrl(filingUrl, selection), [filingUrl, selection])

  // Convert viewport coordinates to container-local coordinates
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
    const handleClick = (e: MouseEvent) => {
      // If clicking inside menu, do nothing
      if (menuRef.current?.contains(e.target as Node)) return
      
      // Don't dismiss on triple-click (allows new selection to trigger)
      if (e.detail === 3) return
      
      // Click outside = dismiss
      onDismiss()
    }

    // Use click (not mousedown) so it fires AFTER mouseup selection capture
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [onDismiss])

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent the click from dismissing
    
    // Confirm selection FIRST - this triggers CSS Highlight
    onConfirm(selection)
    
    try {
      await navigator.clipboard.writeText(shareableUrl)
      
      // Save highlight to localStorage
      const highlight = createHighlight(filingId, filingUrl, selection, selectedText)
      saveHighlight(highlight)
      onHighlightSaved?.()
      
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        onDismiss()
      }, 1500)
    } catch (error) {
      console.error("Failed to copy to clipboard:", error)
    }
  }

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white border border-gray-200 shadow-lg animate-fade-in"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Text preview */}
        <span className="text-sm text-gray-600 max-w-[180px] truncate">
          "{truncateText(selectedText, 35)}"
        </span>
        
        {/* Divider */}
        <div className="w-px h-4 bg-gray-200" />
        
        {/* URL preview */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link2 className="w-3 h-3" />
          <span className="max-w-[120px] truncate">{truncateUrl(shareableUrl)}</span>
        </div>
        
        {/* Divider */}
        <div className="w-px h-4 bg-gray-200" />
        
        {/* Copy button */}
        <button
          onClick={handleCopyLink}
          className="flex items-center justify-center w-7 h-7 hover:bg-gray-100 transition-colors"
          aria-label={copied ? "Copied" : "Copy link"}
        >
          {copied ? (
            <Check className="w-4 h-4 text-brand-teal" />
          ) : (
            <Copy className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </div>
    </div>
  )
}
