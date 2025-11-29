"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { FilingSection } from "./types"
import { getTableCsvUrl, getTableXlsxUrl } from "@/lib/api"
import { Selection, getShareableUrl, TextSelection } from "@/lib/selection-utils"
import { TextHighlight } from "./TextHighlight"
import { FilingContent } from "./FilingContent"

interface FilingRendererProps {
  html: string
  filingId: string
  filingUrl: string
  selection?: Selection | null
  highlightedElement?: number | null
  onSectionsExtracted: (sections: FilingSection[]) => void
  onTextSelection?: (data: { selection: TextSelection; bounds: DOMRect } | null) => void
}

function getTitleFromTarget(element: Element): string | null {
  const bold = element.querySelector("b, strong")
  if (bold?.textContent?.trim()) return bold.textContent.trim()
  
  const heading = element.querySelector("h1, h2, h3, h4, h5, h6")
  if (heading?.textContent?.trim()) return heading.textContent.trim()
  
  let sibling = element.nextElementSibling
  for (let i = 0; i < 5 && sibling; i++) {
    const siblingTitle = sibling.querySelector("b, strong, h1, h2, h3, h4, h5, h6")
    if (siblingTitle?.textContent?.trim()) {
      return siblingTitle.textContent.trim()
    }
    
    const siblingText = sibling.textContent?.trim()
    if (siblingText && siblingText.length > 3 && siblingText.length < 300) {
      return siblingText
    }
    
    sibling = sibling.nextElementSibling
  }
  
  return null
}

function extractSectionsFromToc(doc: Document): FilingSection[] {
  const sections: FilingSection[] = []
  const seenIds = new Set<string>()
  
  const tocLinks = doc.querySelectorAll('a[href^="#"]')
  
  let sentinelIndex = 0
  for (const link of tocLinks) {
    const href = link.getAttribute("href")
    if (!href || href === "#") continue
    
    const targetId = href.substring(1)
    if (seenIds.has(targetId)) continue
    
    const target = doc.getElementById(targetId)
    if (!target) continue
    
    const targetTitle = getTitleFromTarget(target)
    const text = targetTitle || link.textContent?.trim()
    if (!text) continue
    
    // Create observable sentinel element adjacent to anchor
    const sentinelId = `section-sentinel-${sentinelIndex}`
    const sentinel = doc.createElement("span")
    sentinel.id = sentinelId
    sentinel.setAttribute("data-section-anchor", targetId)
    sentinel.style.cssText = "display:block;height:4px;margin:0;padding:0;opacity:0;pointer-events:none;"
    
    // Insert sentinel after the target anchor
    if (target.parentElement) {
      target.parentElement.insertBefore(sentinel, target.nextSibling)
    }
    
    sections.push({ id: sentinelId, level: 1, text })
    seenIds.add(targetId)
    sentinelIndex++
  }
  
  return sections
}

function extractSectionsFromBoldHeadings(doc: Document): FilingSection[] {
  const sections: FilingSection[] = []
  const containers = doc.querySelectorAll("p, div")
  
  let index = 0
  for (const container of containers) {
    const firstChild = container.firstElementChild
    if (!firstChild || (firstChild.tagName !== "B" && firstChild.tagName !== "STRONG")) {
      continue
    }
    
    const text = firstChild.textContent?.trim()
    if (!text || text.length > 200) continue
    
    const id = `section-${index}`
    container.setAttribute("id", id)
    
    sections.push({ id, level: 2, text })
    index++
  }
  
  return sections
}

export function FilingRenderer({ html, filingId, filingUrl, selection, highlightedElement, onSectionsExtracted, onTextSelection }: FilingRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [contentReady, setContentReady] = useState(false)

  // Handle scroll and highlight when a source is clicked from chat
  useEffect(() => {
    if (highlightedElement === null || highlightedElement === undefined) return
    if (!contentReady) return

    const element = document.querySelector(`[data-element-index="${highlightedElement}"]`)
    if (!element) return

    // Scroll element into view
    element.scrollIntoView({ behavior: "smooth", block: "center" })

    // Apply temporary highlight using CSS class
    element.classList.add("source-highlight")
    
    // Remove highlight after animation
    const timer = setTimeout(() => {
      element.classList.remove("source-highlight")
    }, 3000)

    return () => {
      clearTimeout(timer)
      element.classList.remove("source-highlight")
    }
  }, [highlightedElement, contentReady])
  
  const { processedHtml, sections } = useMemo(() => {
    if (typeof window === "undefined") {
      return { processedHtml: html, sections: [] }
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    let extractedSections = extractSectionsFromToc(doc)
    if (extractedSections.length === 0) {
      extractedSections = extractSectionsFromBoldHeadings(doc)
    }

    // Add CSV export buttons to tables
    const tables = doc.querySelectorAll('table[data-table-index]')
    tables.forEach((table) => {
      const index = table.getAttribute('data-table-index')
      if (index === null) return
      
      // Filter out layout/formatting tables - only show buttons for data tables
      const rows = table.querySelectorAll('tr')
      const cells = table.querySelectorAll('td, th')
      const textContent = table.textContent?.trim() || ''
      
      // Heuristics to identify data tables (conservative thresholds)
      const hasNumericContent = /[\$€£¥%]/.test(textContent) || /\d{1,3}(,\d{3})+/.test(textContent) || (textContent.match(/\d+/g) || []).length >= 8  // Financial indicators: currency symbols, formatted numbers, or number-dense
      const isLikelyDataTable = 
        rows.length >= 2 &&          // At least 2 rows
        cells.length >= 6 &&         // At least 6 cells total
        textContent.length > 50 &&   // Substantial content
        hasNumericContent            // Financial data contains numbers
      
      if (!isLikelyDataTable) {
        return // Skip this table - likely layout/formatting
      }
      
      // Create wrapper div
      const wrapper = doc.createElement('div')
      wrapper.className = 'table-export-wrapper'
      wrapper.style.cssText = 'position:relative;margin:1rem 0;'
      
      // Create CSV export button
      const csvButton = doc.createElement('button')
      csvButton.className = 'table-export-btn'
      csvButton.setAttribute('data-export-table', index)
      csvButton.textContent = 'CSV'
      csvButton.style.cssText = 'right: 140px;'
      
      // Create Excel export button (primary action)
      const xlsxButton = doc.createElement('button')
      xlsxButton.className = 'table-export-btn table-export-btn-primary'
      xlsxButton.setAttribute('data-export-xlsx', index)
      xlsxButton.textContent = 'Excel'
      xlsxButton.style.cssText = 'right: 70px;'
      
      // Create share button
      const shareButton = doc.createElement('button')
      shareButton.className = 'table-export-btn'
      shareButton.setAttribute('data-share-table', index)
      shareButton.textContent = 'Share'
      
      // Wrap: parent → wrapper → [csvButton, xlsxButton, shareButton, table]
      table.parentNode?.insertBefore(wrapper, table)
      wrapper.appendChild(csvButton)
      wrapper.appendChild(xlsxButton)
      wrapper.appendChild(shareButton)
      wrapper.appendChild(table)
    })

    const bodyContent = doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML

    return {
      processedHtml: bodyContent,
      sections: extractedSections,
    }
  }, [html])

  useEffect(() => {
    onSectionsExtracted(sections)
  }, [sections, onSectionsExtracted])

  // Event delegation for table action buttons (CSV, XLSX export and share)
  useEffect(() => {
    const handleClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // Handle CSV export
      const csvButton = target.closest('[data-export-table]')
      if (csvButton) {
        const tableIndex = csvButton.getAttribute('data-export-table')
        if (tableIndex !== null) {
          window.location.href = getTableCsvUrl(filingId, parseInt(tableIndex))
        }
        return
      }
      
      // Handle XLSX/Excel export
      const xlsxButton = target.closest('[data-export-xlsx]')
      if (xlsxButton) {
        const tableIndex = xlsxButton.getAttribute('data-export-xlsx')
        if (tableIndex !== null) {
          window.location.href = getTableXlsxUrl(filingId, parseInt(tableIndex))
        }
        return
      }
      
      // Handle table share
      const shareButton = target.closest('[data-share-table]')
      if (shareButton) {
        const tableIndex = shareButton.getAttribute('data-share-table')
        if (tableIndex !== null) {
          const tableSelection: Selection = {
            type: "table",
            tableIndex: parseInt(tableIndex)
          }
          const url = getShareableUrl(filingUrl, tableSelection)
          
          try {
            await navigator.clipboard.writeText(url)
            // Visual feedback: temporarily change button text
            const btn = shareButton as HTMLButtonElement
            const originalText = btn.textContent
            btn.textContent = '✓ Copied!'
            setTimeout(() => {
              btn.textContent = originalText
            }, 2000)
          } catch (error) {
            console.error("Failed to copy to clipboard:", error)
          }
        }
      }
    }
    
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [filingId, filingUrl])

  return (
    <div ref={containerRef} className="w-full max-w-4xl mx-auto px-8 py-6 bg-white text-black rounded-sm shadow-lg my-8 min-h-[calc(100vh-8rem)]">
      {contentReady && selection && selection.type === "text" && (
        <TextHighlight selection={selection} />
      )}
      <FilingContent
        html={processedHtml}
        onTextSelection={onTextSelection}
        onReady={() => setContentReady(true)}
      />
    </div>
  )
}

