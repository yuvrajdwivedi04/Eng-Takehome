"use client"

import { useEffect } from "react"
import { TextSelection } from "@/lib/selection-utils"

interface TextHighlightProps {
  selection: TextSelection
  highlightName?: string
}

function getTextNodeAndOffset(element: Element, targetOffset: number): { node: Text; offset: number } | null {
  let currentOffset = 0
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)
  
  let node: Node | null
  while (node = walker.nextNode()) {
    const textNode = node as Text
    const textLength = textNode.length
    
    if (currentOffset + textLength >= targetOffset) {
      return {
        node: textNode,
        offset: targetOffset - currentOffset
      }
    }
    
    currentOffset += textLength
  }
  
  return null
}

export function TextHighlight({ selection, highlightName = 'shared-selection' }: TextHighlightProps) {
  useEffect(() => {
    // Check if CSS Highlight API is supported
    if (!('highlights' in CSS)) {
      return
    }

    const element = document.querySelector(`[data-element-index="${selection.elementIndex}"]`)
    if (!element) return

    // Scroll element into view for URL deep links
    element.scrollIntoView({ behavior: "smooth", block: "center" })

    try {
      const startPos = getTextNodeAndOffset(element, selection.startOffset)
      const endPos = getTextNodeAndOffset(element, selection.endOffset)
      
      if (!startPos || !endPos) return

      const range = document.createRange()
      range.setStart(startPos.node, startPos.offset)
      range.setEnd(endPos.node, endPos.offset)

      // Use CSS Highlight API with a stable ID so CSS can target it
      const highlight = new Highlight(range)
      CSS.highlights.set(highlightName, highlight)
    } catch (error) {
      console.error('Error creating highlight:', error)
    }
  }, [selection, highlightName])

  return null
}

