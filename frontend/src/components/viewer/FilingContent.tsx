"use client"

import { useEffect, useRef } from "react"
import { TextSelection, TableSelection } from "@/lib/selection-utils"
import { readTextSelection, readTableCellSelection } from "@/hooks/useTextSelection"

interface FilingContentProps {
  html: string
  onTextSelection?: (data: { selection: TextSelection; bounds: DOMRect; selectedText: string } | null) => void
  onTableSelection?: (data: { selection: TableSelection; bounds: DOMRect } | null) => void
  onReady?: () => void
}

export function FilingContent({ html, onTextSelection, onTableSelection, onReady }: FilingContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tableDragRef = useRef<{
    isSelecting: boolean
    startCell: HTMLElement | null
    currentCell: HTMLElement | null
  }>({ isSelecting: false, startCell: null, currentCell: null })

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

  // Attach text selection listener scoped to this container
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

  // Table cell drag selection
  useEffect(() => {
    const el = containerRef.current
    if (!el || !onTableSelection) return

    const clearCellHighlights = () => {
      el.querySelectorAll(".table-cell-selecting").forEach(c => 
        c.classList.remove("table-cell-selecting")
      )
    }

    const highlightRange = (start: HTMLElement, end: HTMLElement) => {
      clearCellHighlights()
      const tableIndex = start.getAttribute("data-table")
      if (!tableIndex || tableIndex !== end.getAttribute("data-table")) return
      
      const r1 = parseInt(start.getAttribute("data-row") ?? "-1", 10)
      const c1 = parseInt(start.getAttribute("data-col") ?? "-1", 10)
      const r2 = parseInt(end.getAttribute("data-row") ?? "-1", 10)
      const c2 = parseInt(end.getAttribute("data-col") ?? "-1", 10)
      
      // Guard against invalid attributes
      if (r1 < 0 || c1 < 0 || r2 < 0 || c2 < 0) return
      const [minR, maxR] = [Math.min(r1, r2), Math.max(r1, r2)]
      const [minC, maxC] = [Math.min(c1, c2), Math.max(c1, c2)]
      
      el.querySelectorAll(`[data-table="${tableIndex}"][data-row][data-col]`).forEach(cell => {
        const row = parseInt(cell.getAttribute("data-row") ?? "-1", 10)
        const col = parseInt(cell.getAttribute("data-col") ?? "-1", 10)
        if (row >= minR && row <= maxR && col >= minC && col <= maxC) {
          cell.classList.add("table-cell-selecting")
        }
      })
    }

    const handleMouseDown = (e: MouseEvent) => {
      const cell = (e.target as HTMLElement).closest("td[data-row], th[data-row]") as HTMLElement
      if (!cell) return
      // DON'T preventDefault — allow text selection to start within cell
      tableDragRef.current = { isSelecting: false, startCell: cell, currentCell: cell }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const { startCell, isSelecting } = tableDragRef.current
      if (!startCell) return
      
      const cell = (e.target as HTMLElement).closest("td[data-row], th[data-row]") as HTMLElement
      if (!cell) return
      
      // Switch to cell selection mode only when crossing to a DIFFERENT cell
      if (cell !== startCell && !isSelecting) {
        tableDragRef.current.isSelecting = true
        window.getSelection()?.removeAllRanges() // Clear any started text selection
      }
      
      if (tableDragRef.current.isSelecting) {
        tableDragRef.current.currentCell = cell
        highlightRange(startCell, cell)
      }
    }

    const handleMouseUp = () => {
      const { isSelecting, startCell, currentCell } = tableDragRef.current
      tableDragRef.current = { isSelecting: false, startCell: null, currentCell: null }
      
      // Only emit if we entered cell-selection mode (crossed cell boundary)
      if (!isSelecting || !startCell || !currentCell) {
        clearCellHighlights()  // Clear only when no valid selection
        return
      }
      
      // Keep highlights visible while menu is shown
      const result = readTableCellSelection(startCell, currentCell)
      onTableSelection(result)
    }

    el.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    return () => {
      el.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [onTableSelection])

  return (
    <div
      ref={containerRef}
      className="prose prose-slate prose-headings:scroll-mt-20 max-w-none filing-content"
    />
  )
}
