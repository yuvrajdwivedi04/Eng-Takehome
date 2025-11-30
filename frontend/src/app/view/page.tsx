"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { fetchFiling } from "@/lib/api"
import { Header } from "@/components/layout/Header"
import { ViewerLayout } from "@/components/layout/ViewerLayout"
import { Sidebar } from "@/components/sidebar/Sidebar"
import { FilingRenderer } from "@/components/viewer/FilingRenderer"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { ChatMessage } from "@/components/chat/types"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { parseSelectionFromUrl, Selection, TextSelection, TableSelection } from "@/lib/selection-utils"
import { SelectionMenu } from "@/components/viewer/SelectionMenu"
import { TableSelectionMenu } from "@/components/viewer/TableSelectionMenu"
import { MessageSquare, AlertTriangle, FileX, ArrowLeft } from "lucide-react"

type SelectionData = {
  selection: TextSelection
  bounds: DOMRect
  selectedText: string
}

type TableSelectionData = {
  selection: TableSelection
  bounds: DOMRect
}

export default function ViewPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const url = searchParams.get("source")
  
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [filingId, setFilingId] = useState<string | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true) // Track if this is first page load
  const [chatMessagesMap, setChatMessagesMap] = useState<Record<string, ChatMessage[]>>({}) // Preserve chat per document
  
  // Get chat messages for current document
  const chatMessages = filingId ? (chatMessagesMap[filingId] || []) : []
  const setChatMessages = useCallback((messages: ChatMessage[]) => {
    if (filingId) {
      setChatMessagesMap(prev => ({ ...prev, [filingId]: messages }))
    }
  }, [filingId])
  const [urlSelection, setUrlSelection] = useState<Selection | null>(null)
  const [activeTextSelection, setActiveTextSelection] = useState<SelectionData | null>(null)
  const [activeTableSelection, setActiveTableSelection] = useState<TableSelectionData | null>(null)
  const [confirmedSelection, setConfirmedSelection] = useState<TextSelection | null>(null)
  const [highlightedElement, setHighlightedElement] = useState<number | null>(null)
  const [highlightVersion, setHighlightVersion] = useState(0)
  const scrollContainerRef = useRef<HTMLElement>(null)
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Handler for when a source is clicked in the chat panel (temporary highlight)
  const handleSourceClick = useCallback((elementIndex: number) => {
    // Clear any existing timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current)
    }
    
    setHighlightedElement(elementIndex)
    
    // Auto-clear highlight after 5 seconds
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedElement(null)
    }, 5000)
  }, [])

  // Handler for when a citation is shared (persistent highlight)
  const handleConfirmSelection = useCallback((selection: TextSelection) => {
    setConfirmedSelection(selection)
  }, [])

  // Handler for when a saved highlight is clicked in the sidebar
  const handleJumpToHighlight = useCallback((selection: Selection) => {
    setUrlSelection(selection)
    if (selection.type === "text") {
      setConfirmedSelection(selection)
    }
  }, [])

  // Handler for when a new highlight is saved (triggers sidebar refresh)
  const handleHighlightSaved = useCallback(() => {
    setHighlightVersion(v => v + 1)
  }, [])

  // Cleanup highlight timeout on unmount
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!url) {
      setError("No filing URL provided")
      setLoading(false)
      return
    }

    const loadFiling = async () => {
      try {
        setLoading(true)
        setError(null) // Clear previous errors when switching documents
        
        // Clear selection state when switching documents
        setActiveTextSelection(null)
        setActiveTableSelection(null)
        setConfirmedSelection(null)
        setHighlightedElement(null)
        
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
        setIsInitialLoad(false) // After first load, subsequent loads are document switches
      }
    }

    loadFiling()
  }, [url, searchParams])

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev)
  }

  const handleToggleChat = () => {
    setIsChatOpen((prev) => !prev)
  }

  // Full skeleton only on initial page load (before we have any filingId)
  if (loading && isInitialLoad) {
    return (
      <ViewerLayout
        header={
          <div className="flex items-center h-14 px-4 border-b border-white/10 bg-dark">
            <Skeleton className="h-10 w-10 mr-3" />
            <Skeleton className="h-7 w-28" />
          </div>
        }
        sidebar={
          <aside className="w-64 border-r border-white/10 bg-dark h-full">
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-20 mb-4" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-3/4" />
            </div>
          </aside>
        }
        content={
          <div className="w-full max-w-4xl mx-auto px-8 py-6">
            <div className="space-y-5">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-5/6" />
              <Skeleton className="h-10 w-2/3 mt-8" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-4/5" />
            </div>
          </div>
        }
      />
    )
  }

  if (error) {
    // Determine error type for appropriate icon and messaging
    const isNotFound = error.toLowerCase().includes("not found") || error.includes("404")
    const isNetworkError = error.toLowerCase().includes("fetch") || error.toLowerCase().includes("network")
    const isInvalidUrl = error.toLowerCase().includes("url") || error.toLowerCase().includes("invalid")
    
    const ErrorIcon = isNotFound ? FileX : AlertTriangle
    const errorTitle = isNotFound 
      ? "Filing Not Found" 
      : isInvalidUrl 
        ? "Invalid Filing URL" 
        : "Unable to Load Filing"
    
    // Simplified user-friendly error messages
    const errorMessage = isNotFound
      ? "The requested SEC filing could not be found."
      : isNetworkError
        ? "Could not connect to SEC servers. Please try again."
        : isInvalidUrl
          ? "The URL provided is not a valid SEC filing."
          : "An error occurred while loading the filing."
    
    return (
      <ViewerLayout
        header={<Header isSidebarOpen={false} onToggleSidebar={() => {}} />}
        sidebar={null}
        content={
          <div className="flex items-center justify-center h-full p-4">
            <div className="w-full max-w-lg animate-fade-in">
              {/* Error card - boxy design matching app aesthetic */}
              <div className="bg-dark border border-white/10 p-8">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 bg-white/5 border border-white/10 flex items-center justify-center">
                    <ErrorIcon className="w-8 h-8 text-gray-400" />
                  </div>
                </div>
                
                {/* Title */}
                <h2 className="text-2xl font-normal text-white text-center mb-3">
                  {errorTitle}
                </h2>
                
                {/* Error message */}
                <p className="text-gray-400 text-center text-sm mb-6">
                  {errorMessage}
                </p>
                
                {/* Attempted URL (if available) */}
                {url && (
                  <div className="bg-white/5 border border-white/10 p-3 mb-6">
                    <p className="text-xs text-gray-500 mb-1">Attempted URL</p>
                    <p className="text-sm text-gray-300 break-all font-mono">
                      {url.length > 80 ? `${url.slice(0, 80)}...` : url}
                    </p>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    onClick={() => router.push("/")}
                    className="flex-1 h-12 bg-white text-dark hover:bg-brand-teal hover:text-white transition-all"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Return Home
                  </Button>
                  {url && (
                    <Button 
                      onClick={() => window.location.reload()}
                      className="flex-1 h-12 bg-white text-dark hover:bg-brand-teal hover:text-white transition-all"
                    >
                      Try Again
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Help text */}
              <p className="text-center text-xs text-gray-500 mt-4">
                {isNetworkError 
                  ? "Check your connection and try again"
                  : "Make sure the URL points to a valid SEC filing"
                }
              </p>
            </div>
          </div>
        }
      />
    )
  }

  // Only show "no data" when not loading and html is null (fetch completed with no data)
  if (!loading && !html && !error) {
    return (
      <ViewerLayout
        header={<Header isSidebarOpen={false} onToggleSidebar={() => {}} />}
        sidebar={null}
        content={
          <div className="flex items-center justify-center h-full p-4">
            <div className="w-full max-w-lg animate-fade-in">
              <div className="bg-dark border border-white/10 p-8">
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 bg-white/5 border border-white/10 flex items-center justify-center">
                    <FileX className="w-8 h-8 text-gray-400" />
                  </div>
                </div>
                <h2 className="text-2xl font-normal text-white text-center mb-3">
                  No Filing Data
                </h2>
                <p className="text-gray-400 text-center text-sm mb-6">
                  The filing could not be loaded or contains no displayable content.
                </p>
                <Button 
                  onClick={() => router.push("/")}
                  className="w-full h-12 bg-white text-dark hover:bg-brand-teal hover:text-white transition-all"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Return Home
                </Button>
              </div>
            </div>
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
          />
        }
        sidebar={<Sidebar filingId={filingId} sourceUrl={url} isOpen={isSidebarOpen} onClose={handleToggleSidebar} onOpen={handleToggleSidebar} highlightVersion={highlightVersion} onJumpToHighlight={handleJumpToHighlight} />}
        content={
          loading && !isInitialLoad ? (
            // Document switch loading - only show skeleton in content area
            <div className="w-full max-w-4xl mx-auto px-8 py-6 bg-white rounded-sm shadow-lg my-8 min-h-[calc(100vh-8rem)]">
              <div className="space-y-5">
                <Skeleton className="h-12 w-3/4 bg-gray-200" />
                <Skeleton className="h-6 w-full bg-gray-200" />
                <Skeleton className="h-6 w-full bg-gray-200" />
                <Skeleton className="h-6 w-5/6 bg-gray-200" />
                <Skeleton className="h-10 w-2/3 bg-gray-200 mt-8" />
                <Skeleton className="h-6 w-full bg-gray-200" />
                <Skeleton className="h-6 w-4/5 bg-gray-200" />
              </div>
            </div>
          ) : (
            <div key={url} className="animate-slide-up-fade">
              <FilingRenderer 
                html={html || ""} 
                filingId={filingId || ""} 
                filingUrl={url || ""}
                selection={urlSelection || confirmedSelection}
                highlightedElement={highlightedElement}
                isDeepLink={!!urlSelection}
                onTextSelection={setActiveTextSelection}
                onTableSelection={setActiveTableSelection}
              />
              {activeTextSelection && url && (
                <SelectionMenu 
                  selection={activeTextSelection.selection}
                  selectedText={activeTextSelection.selectedText}
                  bounds={activeTextSelection.bounds}
                  containerRef={scrollContainerRef}
                  filingId={filingId || ""}
                  filingUrl={url}
                  onConfirm={(sel) => {
                    setConfirmedSelection(sel)
                    setActiveTextSelection(null)
                  }}
                  onDismiss={() => setActiveTextSelection(null)}
                  onHighlightSaved={handleHighlightSaved}
                />
              )}
              {activeTableSelection && url && (
                <TableSelectionMenu
                  selection={activeTableSelection.selection}
                  bounds={activeTableSelection.bounds}
                  containerRef={scrollContainerRef}
                  filingId={filingId || ""}
                  filingUrl={url}
                  onDismiss={() => setActiveTableSelection(null)}
                  onHighlightSaved={handleHighlightSaved}
                />
              )}
            </div>
          )
        }
        chat={filingId && (
          <ChatPanel 
            filingId={filingId}
            filingUrl={url || ""}
            isOpen={isChatOpen}
            messages={chatMessages}
            onMessagesChange={setChatMessages}
            onClose={handleToggleChat}
            onSourceClick={handleSourceClick}
            onConfirmSelection={handleConfirmSelection}
            onHighlightSaved={handleHighlightSaved}
          />
        )}
      />
      
      {/* Floating chat toggle - appears when chat is closed */}
      {!isChatOpen && (
        <Button
          onClick={handleToggleChat}
          className="fixed right-0 top-1/2 -translate-y-1/2 h-16 w-14 rounded-none bg-dark border border-white/10 border-r-0 text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          aria-label="Open chat"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      )}
    </>
  )
}

