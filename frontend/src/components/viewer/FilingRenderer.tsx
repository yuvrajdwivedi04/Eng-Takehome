"use client"

import { useEffect, useMemo } from "react"
import { FilingSection } from "./types"

interface FilingRendererProps {
  html: string
  onSectionsExtracted: (sections: FilingSection[]) => void
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

export function FilingRenderer({ html, onSectionsExtracted }: FilingRendererProps) {
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

    const bodyContent = doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML

    return {
      processedHtml: bodyContent,
      sections: extractedSections,
    }
  }, [html])

  useEffect(() => {
    onSectionsExtracted(sections)
  }, [sections, onSectionsExtracted])

  return (
    <div className="w-full max-w-4xl mx-auto px-8 py-6">
      <div
        className="prose prose-slate prose-headings:scroll-mt-20 max-w-none"
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
    </div>
  )
}

