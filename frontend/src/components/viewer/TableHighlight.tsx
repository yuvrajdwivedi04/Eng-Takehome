"use client"

import { useEffect } from "react"
import { TableSelection } from "@/lib/selection-utils"

interface TableHighlightProps {
  selection: TableSelection
  isDeepLink?: boolean
}

export function TableHighlight({ selection, isDeepLink = false }: TableHighlightProps) {
  useEffect(() => {
    const { tableIndex, startRow, startCol, endRow, endCol } = selection
    
    // Clear any previous table cell highlights
    document.querySelectorAll(".table-cell-selected").forEach(el => {
      el.classList.remove("table-cell-selected")
    })
    
    // If no cell range specified, highlight entire table
    if (startRow === undefined || startCol === undefined || 
        endRow === undefined || endCol === undefined) {
      const table = document.querySelector(`[data-table-index="${tableIndex}"]`)
      if (table) {
        table.scrollIntoView({ behavior: "smooth", block: "center" })
        if (isDeepLink) {
          table.classList.add("source-highlight")
          setTimeout(() => table.classList.remove("source-highlight"), 3000)
        }
      }
      return
    }
    
    const minRow = Math.min(startRow, endRow)
    const maxRow = Math.max(startRow, endRow)
    const minCol = Math.min(startCol, endCol)
    const maxCol = Math.max(startCol, endCol)
    
    // Find and highlight selected cells
    const cells = document.querySelectorAll(
      `[data-table="${tableIndex}"][data-row][data-col]`
    )
    
    let firstCell: Element | null = null
    
    cells.forEach(cell => {
      const row = parseInt(cell.getAttribute("data-row") ?? "-1", 10)
      const col = parseInt(cell.getAttribute("data-col") ?? "-1", 10)
      
      if (row >= minRow && row <= maxRow && col >= minCol && col <= maxCol) {
        cell.classList.add("table-cell-selected")
        if (!firstCell) firstCell = cell
      }
    })
    
    // Scroll to first selected cell
    if (firstCell) {
      firstCell.scrollIntoView({ behavior: "smooth", block: "center" })
      
      // Add arrival animation for deep links
      if (isDeepLink && firstCell) {
        setTimeout(() => {
          firstCell?.classList.add("highlight-arrival")
          setTimeout(() => {
            firstCell?.classList.remove("highlight-arrival")
          }, 600)
        }, 500)
      }
    }
    
    // Cleanup on unmount
    return () => {
      document.querySelectorAll(".table-cell-selected").forEach(el => {
        el.classList.remove("table-cell-selected")
      })
    }
  }, [selection, isDeepLink])

  return null // Effect-only component
}

