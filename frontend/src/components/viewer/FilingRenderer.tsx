"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { getTableCsvUrl, getTableXlsxUrl } from "@/lib/api"
import { Selection, getShareableUrl, TextSelection, TableSelection } from "@/lib/selection-utils"
import { TextHighlight } from "./TextHighlight"
import { TableHighlight } from "./TableHighlight"
import { FilingContent } from "./FilingContent"

interface FilingRendererProps {
  html: string
  filingId: string
  filingUrl: string
  selection?: Selection | null
  highlightedElement?: number | null
  isDeepLink?: boolean
  onTextSelection?: (data: { selection: TextSelection; bounds: DOMRect; selectedText: string } | null) => void
  onTableSelection?: (data: { selection: TableSelection; bounds: DOMRect } | null) => void
}

export function FilingRenderer({ html, filingId, filingUrl, selection, highlightedElement, isDeepLink = false, onTextSelection, onTableSelection }: FilingRendererProps) {
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
  
  const processedHtml = useMemo(() => {
    if (typeof window === "undefined") {
      return html
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

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
      
      // Create button group container
      const buttonGroup = doc.createElement('div')
      buttonGroup.className = 'table-export-group'
      
      // Download icon SVG (reusable)
      const downloadIcon = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>'
      
      // Share icon SVG
      const shareIcon = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>'
      
      // Create CSV export button
      const csvButton = doc.createElement('button')
      csvButton.className = 'table-export-btn'
      csvButton.setAttribute('data-export-table', index)
      csvButton.innerHTML = downloadIcon + 'CSV'
      
      // Create Excel export button
      const xlsxButton = doc.createElement('button')
      xlsxButton.className = 'table-export-btn'
      xlsxButton.setAttribute('data-export-xlsx', index)
      xlsxButton.innerHTML = downloadIcon + 'Excel'
      
      // Create share button
      const shareButton = doc.createElement('button')
      shareButton.className = 'table-export-btn'
      shareButton.setAttribute('data-share-table', index)
      shareButton.innerHTML = shareIcon + 'Share'
      
      // Assemble: wrapper → buttonGroup → [buttons], table
      buttonGroup.appendChild(csvButton)
      buttonGroup.appendChild(xlsxButton)
      buttonGroup.appendChild(shareButton)
      
      table.parentNode?.insertBefore(wrapper, table)
      wrapper.appendChild(buttonGroup)
      wrapper.appendChild(table)
    })

    const bodyContent = doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML

    return bodyContent
  }, [html])

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
    <div ref={containerRef} className="relative w-full max-w-4xl mx-auto px-8 py-6 bg-white text-black rounded-sm shadow-lg my-8 min-h-[calc(100vh-8rem)]">
      {contentReady && selection && selection.type === "text" && (
        <TextHighlight selection={selection} isDeepLink={isDeepLink} />
      )}
      {contentReady && selection && selection.type === "table" && (
        <TableHighlight selection={selection} isDeepLink={isDeepLink} />
      )}
      <FilingContent
        html={processedHtml}
        onTextSelection={onTextSelection}
        onTableSelection={onTableSelection}
        onReady={() => setContentReady(true)}
      />
    </div>
  )
}

