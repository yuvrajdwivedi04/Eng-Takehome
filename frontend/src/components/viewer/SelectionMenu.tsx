"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { TextSelection, getShareableUrl } from "@/lib/selection-utils"
import { Link2 } from "lucide-react"

interface SelectionMenuProps {
  selection: TextSelection
  bounds: DOMRect
  containerRef: React.RefObject<HTMLElement>
  filingUrl: string
  onConfirm: (selection: TextSelection) => void
  onDismiss: () => void
}

export function SelectionMenu({ selection, bounds, containerRef, filingUrl, onConfirm, onDismiss }: SelectionMenuProps) {
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
    
    const url = getShareableUrl(filingUrl, selection)
    
    try {
      await navigator.clipboard.writeText(url)
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
      className="absolute z-50 bg-white border border-gray-200 rounded-md shadow-lg"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <button
        onClick={handleCopyLink}
        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors w-full text-left"
      >
        <Link2 className="h-4 w-4" />
        {copied ? "Copied!" : "Link"}
      </button>
    </div>
  )
}
