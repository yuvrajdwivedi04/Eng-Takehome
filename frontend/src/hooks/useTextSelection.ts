import { TextSelection, TableSelection } from "@/lib/selection-utils"

function calculateTextOffset(element: Element, node: Node, offset: number): number {
  let currentOffset = 0
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)
  
  let currentNode: Node | null
  while (currentNode = walker.nextNode()) {
    if (currentNode === node) {
      return currentOffset + offset
    }
    currentOffset += (currentNode as Text).length
  }
  
  return currentOffset
}

/**
 * Pure helper function to read text selection from the browser and compute offsets.
 * Returns null if no valid selection exists within the container.
 */
export function readTextSelection(container: HTMLElement): { selection: TextSelection; bounds: DOMRect; selectedText: string } | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null

  const range = sel.getRangeAt(0)
  if (!container.contains(range.commonAncestorContainer)) return null

  // Find element with data-element-index, starting from selection start
  // This anchors cross-element selections to the starting element
  const startNode = range.startContainer
  let element: HTMLElement | null = startNode.nodeType === Node.TEXT_NODE
    ? startNode.parentElement
    : startNode as HTMLElement
  
  while (element && element !== container) {
    if (element.hasAttribute('data-element-index')) break
    element = element.parentElement
  }

  if (!element || !element.hasAttribute('data-element-index')) return null

  const elementIndex = parseInt(element.getAttribute('data-element-index')!, 10)
  const startOffset = calculateTextOffset(element, range.startContainer, range.startOffset)
  const endOffset = calculateTextOffset(element, range.endContainer, range.endOffset)
  const bounds = range.getBoundingClientRect()
  const selectedText = sel.toString()

  return {
    selection: { type: "text", elementIndex, startOffset, endOffset },
    bounds,
    selectedText
  }
}

/**
 * Read table cell selection from a completed drag operation.
 * Returns null if cells are not in the same data table.
 */
export function readTableCellSelection(
  startCell: HTMLElement,
  endCell: HTMLElement
): { selection: TableSelection; bounds: DOMRect } | null {
  const startTable = startCell.getAttribute("data-table")
  const endTable = endCell.getAttribute("data-table")
  
  if (!startTable || startTable !== endTable) return null
  
  const startRow = parseInt(startCell.getAttribute("data-row") || "-1", 10)
  const startCol = parseInt(startCell.getAttribute("data-col") || "-1", 10)
  const endRow = parseInt(endCell.getAttribute("data-row") || "-1", 10)
  const endCol = parseInt(endCell.getAttribute("data-col") || "-1", 10)
  
  if (startRow < 0 || startCol < 0 || endRow < 0 || endCol < 0) return null
  
  const startRect = startCell.getBoundingClientRect()
  const endRect = endCell.getBoundingClientRect()
  const bounds = new DOMRect(
    Math.min(startRect.left, endRect.left),
    Math.min(startRect.top, endRect.top),
    Math.abs(endRect.right - startRect.left),
    Math.abs(endRect.bottom - startRect.top)
  )
  
  return {
    selection: {
      type: "table",
      tableIndex: parseInt(startTable, 10),
      startRow: Math.min(startRow, endRow),
      startCol: Math.min(startCol, endCol),
      endRow: Math.max(startRow, endRow),
      endCol: Math.max(startCol, endCol)
    },
    bounds
  }
}
