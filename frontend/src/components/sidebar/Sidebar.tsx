"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { fetchExhibits, Exhibit, getAllTablesXlsxUrl, getAllTablesCsvZipUrl } from "@/lib/api"
import { Download, ChevronDown, ExternalLink, Loader2, X, PanelLeft } from "lucide-react"

const ORIGINAL_FILING_KEY = "endex_original_filing_url"

interface SidebarProps {
  filingId: string | null
  sourceUrl: string | null
  isOpen: boolean
  onClose?: () => void
  onOpen?: () => void
}

export function Sidebar({ filingId, sourceUrl, isOpen, onClose, onOpen }: SidebarProps) {
  const router = useRouter()
  const [exhibits, setExhibits] = useState<Exhibit[]>([])
  const [loading, setLoading] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [originalFilingUrl, setOriginalFilingUrl] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Track original filing URL (for determining which doc is active)
  useEffect(() => {
    if (!sourceUrl) return
    
    const stored = sessionStorage.getItem(ORIGINAL_FILING_KEY)
    const isExhibit = /exhibit|ex[-_]?\d/i.test(sourceUrl)
    
    if (!stored && !isExhibit) {
      sessionStorage.setItem(ORIGINAL_FILING_KEY, sourceUrl)
      setOriginalFilingUrl(sourceUrl)
    } else if (stored) {
      setOriginalFilingUrl(stored)
    }
  }, [sourceUrl])

  // Fetch exhibits when filingId changes
  useEffect(() => {
    if (!filingId) {
      setExhibits([])
      return
    }
    
    setLoading(true)
    fetchExhibits(filingId)
      .then(res => setExhibits(res.exhibits))
      .catch(() => setExhibits([]))
      .finally(() => setLoading(false))
  }, [filingId])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDownloadOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Handle document click - navigate in same page
  const handleDocClick = (e: React.MouseEvent, url: string) => {
    e.preventDefault()
    
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      window.open(`/view?source=${encodeURIComponent(url)}`, "_blank")
    } else {
      router.push(`/view?source=${encodeURIComponent(url)}`)
    }
  }

  // Check if a URL is the currently viewed document
  const isActiveDoc = (url: string) => sourceUrl === url

  // Check if main filing is active (not viewing an exhibit)
  const isMainFilingActive = originalFilingUrl && sourceUrl === originalFilingUrl

  // Extract filename from URL for display
  const getFilenameFromUrl = (url: string) => {
    try {
      const pathname = new URL(url).pathname
      const filename = pathname.split('/').pop() || ''
      // Remove extension and clean up
      return filename.replace(/\.(htm|html|txt)$/i, '')
    } catch {
      return 'Filing'
    }
  }

  const mainFilingName = originalFilingUrl ? getFilenameFromUrl(originalFilingUrl) : 'Main Filing'

  return (
    <>
      {/* Reopen tab - shown when sidebar is closed */}
      {!isOpen && onOpen && (
        <button
          onClick={onOpen}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-30 bg-dark border border-white/10 border-l-0 p-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors rounded-r"
          aria-label="Open sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      )}
      
      <aside 
        className={cn(
          "border-r border-white/10 bg-dark h-full overflow-hidden transition-all duration-300 ease-in-out relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.25)]",
          isOpen ? "w-64" : "w-0 border-r-0"
        )}
      >
        <div className="w-64 h-full flex flex-col">
          {/* Close button - top right */}
          {onClose && (
            <div className="flex justify-end px-3 pt-3">
              <button
                onClick={onClose}
                className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 transition-colors rounded"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          
          {/* Scrollable content with auto-hide scrollbar */}
          <div className="flex-1 overflow-y-auto scrollbar-subtle">
            <div className="p-4 space-y-6">
              
              {/* Actions Section */}
              <div>
                <h2 className="text-xs font-semibold mb-3 text-gray-500 uppercase tracking-wider">Actions</h2>
                
                {/* Download Tables Dropdown */}
                {filingId && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setDownloadOpen(!downloadOpen)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-300 border border-white/10 transition-colors",
                        downloadOpen ? "bg-brand-teal/10 text-brand-teal border-brand-teal/30" : "hover:bg-brand-teal/10 hover:text-brand-teal"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Download Tables
                      </span>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform",
                        downloadOpen && "rotate-180"
                      )} />
                    </button>
                    
                    {downloadOpen && (
                      <div className="border border-white/10 border-t-0">
                        <button
                          onClick={() => {
                            window.location.href = getAllTablesXlsxUrl(filingId)
                            setDownloadOpen(false)
                          }}
                          className="w-full px-3 py-2.5 text-sm text-left text-gray-300 hover:bg-brand-teal/10 hover:text-brand-teal transition-colors border-b border-white/10"
                        >
                          Excel (.xlsx)
                        </button>
                        <button
                          onClick={() => {
                            window.location.href = getAllTablesCsvZipUrl(filingId)
                            setDownloadOpen(false)
                          }}
                          className="w-full px-3 py-2.5 text-sm text-left text-gray-300 hover:bg-brand-teal/10 hover:text-brand-teal transition-colors"
                        >
                          CSV (.zip)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Documents Section */}
              <div>
                <h2 className="text-xs font-semibold mb-3 text-gray-500 uppercase tracking-wider">Documents</h2>
                
                <div className="border border-white/10">
                  {/* Main Filing - always shown first */}
                  {originalFilingUrl && (
                    <button
                      onClick={(e) => handleDocClick(e, originalFilingUrl)}
                      onAuxClick={(e) => handleDocClick(e, originalFilingUrl)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 transition-colors border-b border-white/10",
                        isMainFilingActive 
                          ? "bg-white/5 text-brand-teal" 
                          : "text-gray-300 hover:bg-white/5 hover:text-brand-teal"
                      )}
                    >
                      <span className="font-medium whitespace-nowrap min-w-[60px]">Filing</span>
                      <span className="text-gray-500 truncate text-xs">{mainFilingName}</span>
                    </button>
                  )}
                  
                  {/* Exhibits */}
                  {loading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 text-gray-500 animate-spin" />
                    </div>
                  ) : exhibits.length === 0 ? (
                    <p className="text-sm text-gray-500 px-3 py-2.5">No exhibits</p>
                  ) : (
                    exhibits.map((exhibit, index) => (
                      <button
                        key={exhibit.url}
                        onClick={(e) => handleDocClick(e, exhibit.url)}
                        onAuxClick={(e) => handleDocClick(e, exhibit.url)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-3",
                          isActiveDoc(exhibit.url)
                            ? "bg-white/5 text-brand-teal"
                            : "text-gray-300 hover:bg-white/5 hover:text-brand-teal",
                          index !== exhibits.length - 1 && "border-b border-white/10"
                        )}
                      >
                        <span className="font-medium whitespace-nowrap min-w-[60px]">
                          {exhibit.name}
                        </span>
                        <span className="text-gray-500 truncate text-xs">
                          {exhibit.description !== exhibit.name ? exhibit.description : ""}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* View on SEC.gov - Fixed at bottom */}
          {sourceUrl && (
            <div className="p-4 border-t border-white/10">
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-300 border border-white/10 hover:bg-brand-teal/10 hover:text-brand-teal transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                View on SEC.gov
              </a>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
