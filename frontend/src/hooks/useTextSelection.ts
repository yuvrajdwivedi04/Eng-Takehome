import { TextSelection } from "@/lib/selection-utils"

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
export function readTextSelection(container: HTMLElement): { selection: TextSelection; bounds: DOMRect } | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null

  const range = sel.getRangeAt(0)
  if (!container.contains(range.commonAncestorContainer)) return null

  // Find element with data-element-index
  let element = range.commonAncestorContainer.parentElement
  while (element && element !== container) {
    if (element.hasAttribute('data-element-index')) break
    element = element.parentElement
  }

  if (!element || !element.hasAttribute('data-element-index')) return null

  const elementIndex = parseInt(element.getAttribute('data-element-index')!, 10)
  const startOffset = calculateTextOffset(element, range.startContainer, range.startOffset)
  const endOffset = calculateTextOffset(element, range.endContainer, range.endOffset)
  const bounds = range.getBoundingClientRect()

  return {
    selection: { type: "text", elementIndex, startOffset, endOffset },
    bounds
  }
}
