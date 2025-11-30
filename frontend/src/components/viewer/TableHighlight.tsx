"use client"

import { useEffect, useRef } from "react"
import { TableSelection } from "@/lib/selection-utils"

interface TableHighlightProps {
  selection: TableSelection
  isDeepLink?: boolean
}

export function TableHighlight({ selection, isDeepLink = false }: TableHighlightProps) {
  // Timer refs for proper cleanup
  const tableHighlightTimer = useRef<NodeJS.Timeout | null>(null)
  const arrivalTimer = useRef<NodeJS.Timeout | null>(null)
  const arrivalRemoveTimer = useRef<NodeJS.Timeout | null>(null)
  
  // Track specific elements we highlight (avoid global cleanup collision)
  const highlightedTableRef = useRef<Element | null>(null)
  const highlightedCellRef = useRef<Element | null>(null)

  useEffect(() => {
    const { tableIndex, startRow, startCol, endRow, endCol } = selection
    
    // Clear any previous table cell highlights
    document.querySelectorAll(".table-cell-selected").forEach(el => {
      el.classList.remove("table-cell-selected")
    })
    
    // BRANCH 1: No cell range - highlight entire table
    // Keep condition INLINE for TypeScript narrowing (don't extract to variable)
    if (startRow === undefined || startCol === undefined || 
        endRow === undefined || endCol === undefined) {
      const table = document.querySelector(`[data-table-index="${tableIndex}"]`)
      if (table) {
        table.scrollIntoView({ behavior: "smooth", block: "center" })
        if (isDeepLink) {
          highlightedTableRef.current = table
          table.classList.add("source-highlight")
          tableHighlightTimer.current = setTimeout(() => {
            table.classList.remove("source-highlight")
          }, 3000)
        }
      }
    } else {
      // BRANCH 2: Cell range specified - highlight specific cells
      // TypeScript correctly narrows: all four values are defined here
      const minRow = Math.min(startRow, endRow)
      const maxRow = Math.max(startRow, endRow)
      const minCol = Math.min(startCol, endCol)
      const maxCol = Math.max(startCol, endCol)
      
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
      
      if (firstCell) {
        firstCell.scrollIntoView({ behavior: "smooth", block: "center" })
        
        if (isDeepLink) {
          highlightedCellRef.current = firstCell
          arrivalTimer.current = setTimeout(() => {
            firstCell?.classList.add("highlight-arrival")
            arrivalRemoveTimer.current = setTimeout(() => {
              firstCell?.classList.remove("highlight-arrival")
            }, 600)
          }, 500)
        }
      }
    }
    
    // ALWAYS return cleanup (fixes early return bug)
    return () => {
      // Clear all pending timers
      if (tableHighlightTimer.current) clearTimeout(tableHighlightTimer.current)
      if (arrivalTimer.current) clearTimeout(arrivalTimer.current)
      if (arrivalRemoveTimer.current) clearTimeout(arrivalRemoveTimer.current)
      
      // Remove classes ONLY from elements we touched (not global!)
      highlightedTableRef.current?.classList.remove("source-highlight")
      highlightedCellRef.current?.classList.remove("highlight-arrival")
      
      // table-cell-selected IS safe for global cleanup (only we use it)
      document.querySelectorAll(".table-cell-selected").forEach(el => {
        el.classList.remove("table-cell-selected")
      })
    }
  }, [selection, isDeepLink])

  return null
}
