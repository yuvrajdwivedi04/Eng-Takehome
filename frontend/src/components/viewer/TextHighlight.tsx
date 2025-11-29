"use client"

import { useEffect, useState } from "react"
import { TextSelection } from "@/lib/selection-utils"
import { NavigationToast } from "./NavigationToast"

interface TextHighlightProps {
  selection: TextSelection
  highlightName?: string
  isDeepLink?: boolean
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

export function TextHighlight({ selection, highlightName = 'shared-selection', isDeepLink = false }: TextHighlightProps) {
  const [showToast, setShowToast] = useState(isDeepLink)

  useEffect(() => {
    // Check if CSS Highlight API is supported
    if (!('highlights' in CSS)) {
      return
    }

    const element = document.querySelector(`[data-element-index="${selection.elementIndex}"]`)
    if (!element) return

    // Scroll element into view for URL deep links
    element.scrollIntoView({ behavior: "smooth", block: "center" })

    // Store timer refs for cleanup
    let arrivalTimer: NodeJS.Timeout | undefined
    let removeArrivalTimer: NodeJS.Timeout | undefined

    // Add arrival animation class after scroll completes (approx 500ms for smooth scroll)
    if (isDeepLink) {
      arrivalTimer = setTimeout(() => {
        element.classList.add("highlight-arrival")
        // Remove class after animation completes
        removeArrivalTimer = setTimeout(() => {
          element.classList.remove("highlight-arrival")
        }, 600)
      }, 500)
    }

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

    return () => {
      if (arrivalTimer) clearTimeout(arrivalTimer)
      if (removeArrivalTimer) clearTimeout(removeArrivalTimer)
    }
  }, [selection, highlightName, isDeepLink])

  return showToast ? <NavigationToast onComplete={() => setShowToast(false)} /> : null
}

