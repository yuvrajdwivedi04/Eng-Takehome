"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { fetchFiling } from "@/lib/api"
import { Header } from "@/components/layout/Header"
import { ViewerLayout } from "@/components/layout/ViewerLayout"
import { Sidebar } from "@/components/sidebar/Sidebar"
import { FilingRenderer } from "@/components/viewer/FilingRenderer"
import { FilingSection } from "@/components/viewer/types"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { ChatMessage } from "@/components/chat/types"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { parseSelectionFromUrl, Selection, TextSelection } from "@/lib/selection-utils"
import { SelectionMenu } from "@/components/viewer/SelectionMenu"

type SelectionData = {
  selection: TextSelection
  bounds: DOMRect
}

export default function ViewPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const url = searchParams.get("source")
  
  const [html, setHtml] = useState<string | null>(null)
  const [sections, setSections] = useState<FilingSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [filingId, setFilingId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [urlSelection, setUrlSelection] = useState<Selection | null>(null)
  const [activeTextSelection, setActiveTextSelection] = useState<SelectionData | null>(null)
  const [confirmedSelection, setConfirmedSelection] = useState<TextSelection | null>(null)
  const scrollContainerRef = useRef<HTMLElement>(null)


  useEffect(() => {
    if (!url) {
      setError("No filing URL provided")
      setLoading(false)
      return
    }

    const loadFiling = async () => {
      try {
        setLoading(true)
        const data = await fetchFiling(url)
        setHtml(data.html)
        setFilingId(data.id)
        
        // Parse selection from URL if present
        const parsedSelection = parseSelectionFromUrl(searchParams)
        setUrlSelection(parsedSelection)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load filing")
      } finally {
        setLoading(false)
      }
    }

    loadFiling()
  }, [url, searchParams])

  const handleSectionsExtracted = useCallback((extractedSections: FilingSection[]) => {
    setSections(extractedSections)
  }, [])

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev)
  }

  const handleToggleChat = () => {
    setIsChatOpen((prev) => !prev)
  }

  useEffect(() => {
    if (sections.length === 0) return

    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const elements = sections
      .map((section) => ({ id: section.id, el: document.getElementById(section.id) }))
      .filter((item): item is { id: string; el: HTMLElement } => item.el !== null)

    if (elements.length === 0) return

    let ticking = false

    const handleScroll = () => {
      if (ticking) return
      ticking = true

      requestAnimationFrame(() => {
        const containerTop = scrollContainer.getBoundingClientRect().top + 100

        let currentSection: string | null = null
        for (const { id, el } of elements) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= containerTop) {
            currentSection = id
          } else {
            break
          }
        }

        if (currentSection && currentSection !== activeSection) {
          setActiveSection(currentSection)
        }
        
        ticking = false
      })
    }

    handleScroll()
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll)
    }
  }, [sections, activeSection])

  if (loading) {
    return (
      <ViewerLayout
        header={
          <div className="flex items-center h-14 px-4 border-b">
            <Skeleton className="h-10 w-10 mr-2" />
            <Skeleton className="h-6 w-24" />
          </div>
        }
        sidebar={
          <aside className="w-64 border-r bg-muted/10">
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-20 mb-4" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          </aside>
        }
        content={
          <div className="w-full max-w-4xl mx-auto px-8 py-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-8 w-2/3 mt-8" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        }
      />
    )
  }

  if (error) {
    return (
      <ViewerLayout
        header={<Header isSidebarOpen={false} onToggleSidebar={() => {}} isChatOpen={false} onToggleChat={() => {}} />}
        sidebar={null}
        content={
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4 max-w-md">
              <h2 className="text-2xl font-semibold">Unable to load filing</h2>
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={() => router.push("/")}>Return to Home</Button>
            </div>
          </div>
        }
      />
    )
  }

  if (!html) {
    return (
      <ViewerLayout
        header={<Header isSidebarOpen={false} onToggleSidebar={() => {}} isChatOpen={false} onToggleChat={() => {}} />}
        sidebar={null}
        content={
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No filing data available</p>
          </div>
        }
      />
    )
  }

  return (
    <>
      <ViewerLayout
        ref={scrollContainerRef}
        header={
          <Header
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={handleToggleSidebar}
            isChatOpen={isChatOpen}
            onToggleChat={handleToggleChat}
          />
        }
        sidebar={<Sidebar sections={sections} isOpen={isSidebarOpen} activeSection={activeSection} />}
        content={
          <>
            <FilingRenderer 
              html={html} 
              filingId={filingId || ""} 
              filingUrl={url}
              selection={urlSelection || confirmedSelection}
              onSectionsExtracted={handleSectionsExtracted}
              onTextSelection={setActiveTextSelection}
            />
            {activeTextSelection && url && (
              <SelectionMenu 
                selection={activeTextSelection.selection}
                bounds={activeTextSelection.bounds}
                containerRef={scrollContainerRef}
                filingUrl={url}
                onConfirm={(sel) => {
                  setConfirmedSelection(sel)
                  setActiveTextSelection(null)
                }}
                onDismiss={() => setActiveTextSelection(null)}
              />
            )}
          </>
        }
        chat={isChatOpen && filingId && (
          <ChatPanel 
            filingId={filingId} 
            isOpen={isChatOpen}
            messages={chatMessages}
            onMessagesChange={setChatMessages}
          />
        )}
      />
    </>
  )
}

