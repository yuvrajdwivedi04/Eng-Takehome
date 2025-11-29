"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { searchByTicker, searchByCIK, CompanyFilingsResponse, CompanyFiling } from "@/lib/api"
import { ArrowLeft, ExternalLink, Building2 } from "lucide-react"

// Form type filter options
const FORM_FILTERS = ["All", "10-K", "10-Q", "8-K", "DEF 14A", "S-1", "4", "13F-HR", "6-K", "20-F"]

// Items to show per page
const PAGE_SIZE = 20

function BrowseContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const mode = searchParams.get("mode") as "ticker" | "cik" | null
  const query = searchParams.get("q")
  
  const [companyData, setCompanyData] = useState<CompanyFilingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formFilter, setFormFilter] = useState("All")
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)

  useEffect(() => {
    async function fetchData() {
      if (!mode || !query) {
        setError("Missing search parameters")
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const result = mode === "ticker" 
          ? await searchByTicker(query)
          : await searchByCIK(query)
        setCompanyData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch filings")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [mode, query])

  // Filter filings by form type
  const filteredFilings = companyData?.filings.filter(filing => 
    formFilter === "All" || filing.form === formFilter || filing.form.startsWith(formFilter + "/")
  ) || []

  // Paginated filings
  const displayedFilings = filteredFilings.slice(0, displayCount)
  const hasMore = displayCount < filteredFilings.length

  const handleOpenFiling = (url: string) => {
    router.push(`/view?source=${encodeURIComponent(url)}`)
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "short", 
        day: "numeric" 
      })
    } catch {
      return dateStr
    }
  }

  const getFormTextColor = (form: string) => {
    if (form.startsWith("10-K")) return "text-emerald-400"
    if (form.startsWith("10-Q")) return "text-blue-400"
    if (form.startsWith("8-K")) return "text-amber-400"
    if (form.startsWith("DEF") || form.startsWith("DEFA")) return "text-purple-400"
    if (form.startsWith("S-") || form.startsWith("F-")) return "text-rose-400"
    if (form === "4") return "text-cyan-400"
    return "text-gray-400"
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark">
        {/* Header skeleton */}
        <div className="border-b border-white/10 bg-dark/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
        
        {/* Content skeleton */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Skeleton className="h-24 w-full mb-8" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-semibold text-white">Unable to load filings</h2>
          <p className="text-gray-400">{error}</p>
          <Button onClick={() => router.push("/")} className="rounded-none">
            Return to Home
          </Button>
        </div>
      </div>
    )
  }

  if (!companyData) {
    return null
  }

  return (
    <div className="min-h-screen bg-dark">
      {/* Header */}
      <div className="border-b border-white/10 bg-dark/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/">
            <Image 
              src="/fonts/logo.png" 
              alt="EndSec" 
              width={120} 
              height={40} 
              className="h-8 w-auto"
            />
          </Link>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Back button */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to search</span>
        </button>

        {/* Company Header */}
        <div className="bg-input-bg border border-white/10 p-6 mb-8">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-7 w-7 text-gray-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-white mb-2">{companyData.name}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                {companyData.ticker && (
                  <span className="text-brand-teal font-medium">
                    {companyData.ticker}
                  </span>
                )}
                <span>CIK: {companyData.cik}</span>
                <span>{filteredFilings.length} filings</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FORM_FILTERS.map((form) => {
            const count = form === "All" 
              ? companyData.filings.length 
              : companyData.filings.filter(f => f.form === form || f.form.startsWith(form + "/")).length
            
            if (form !== "All" && count === 0) return null
            
            return (
              <button
                key={form}
                onClick={() => {
                  setFormFilter(form)
                  setDisplayCount(PAGE_SIZE)
                }}
                className={`px-3 py-1.5 text-sm border transition-colors ${
                  formFilter === form
                    ? "bg-white text-dark border-white"
                    : "bg-transparent text-gray-400 border-white/20 hover:border-white/40"
                }`}
              >
                {form} ({count})
              </button>
            )
          })}
        </div>

        {/* Filings Table */}
        <div className="border border-white/10">
          {/* Table Header */}
          <div className="grid grid-cols-[100px_100px_1fr_140px] gap-4 px-4 py-3 bg-white/5 border-b border-white/10 text-sm text-gray-400 font-medium">
            <div>Date</div>
            <div>Form</div>
            <div>Description</div>
            <div></div>
          </div>
          
          {/* Table Rows */}
          {displayedFilings.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-500">
              No filings found for this filter
            </div>
          ) : (
            displayedFilings.map((filing, index) => (
              <div 
                key={filing.accessionNumber}
                className={`grid grid-cols-[100px_100px_1fr_140px] gap-4 px-4 py-3 items-center hover:bg-white/5 transition-colors ${
                  index !== displayedFilings.length - 1 ? "border-b border-white/5" : ""
                }`}
              >
                <div className="text-sm text-gray-300">
                  {formatDate(filing.filingDate)}
                </div>
                <div>
                  <span className={`text-sm font-medium ${getFormTextColor(filing.form)}`}>
                    {filing.form}
                  </span>
                </div>
                <div className="text-sm text-gray-300 truncate" title={filing.description}>
                  {filing.description}
                </div>
                <div>
                  <Button
                    onClick={() => handleOpenFiling(filing.url)}
                    size="sm"
                    className="rounded-none bg-brand-teal/20 text-brand-teal border border-brand-teal/30 hover:bg-brand-teal hover:text-dark transition-colors h-8 text-xs"
                  >
                    <ExternalLink className="h-3 w-3 mr-1.5" />
                    Open in Endex
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setDisplayCount(prev => prev + PAGE_SIZE)}
              className="px-6 py-2.5 text-sm border border-white/20 text-gray-300 hover:border-white/40 hover:text-white bg-transparent transition-colors"
            >
              Load more ({filteredFilings.length - displayCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BrowsePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <BrowseContent />
    </Suspense>
  )
}

