"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { FrameGrid } from "@/components/ui/FrameGrid"
import { HeatmapGrid } from "@/components/home/HeatmapGrid"
import { ChevronDown } from "lucide-react"

type SearchMode = "url" | "ticker" | "cik"

const SEARCH_MODES: { value: SearchMode; label: string; placeholder: string }[] = [
  { value: "url", label: "URL", placeholder: "https://www.sec.gov/..." },
  { value: "ticker", label: "Ticker", placeholder: "AAPL, MSFT, GOOGL..." },
  { value: "cik", label: "CIK", placeholder: "320193, 789019..." },
]

export default function Home() {
  const [searchMode, setSearchMode] = useState<SearchMode>("url")
  const [inputValue, setInputValue] = useState("")
  const [validationError, setValidationError] = useState("")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const currentMode = SEARCH_MODES.find(m => m.value === searchMode)!

  const validateInput = (): boolean => {
    if (!inputValue.trim()) {
      setValidationError("Please enter a value")
      return false
    }

    if (searchMode === "url") {
      if (!inputValue.startsWith("http://") && !inputValue.startsWith("https://")) {
        setValidationError("URL must start with http:// or https://")
        return false
      }
    }

    if (searchMode === "cik") {
      if (!/^\d+$/.test(inputValue.trim())) {
        setValidationError("CIK must be numeric")
        return false
      }
    }

    setValidationError("")
    return true
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateInput()) {
      return
    }

    if (searchMode === "url") {
      router.push(`/view?source=${encodeURIComponent(inputValue)}`)
    } else {
      router.push(`/browse?mode=${searchMode}&q=${encodeURIComponent(inputValue.trim())}`)
    }
  }

  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode)
    setIsDropdownOpen(false)
    setInputValue("")
    setValidationError("")
  }

  return (
    <>
      <FrameGrid />
      
      {/* Logo - positioned to the right of the left vertical line, centered vertically in the header space */}
      <div className="fixed top-8 left-12 md:left-40 z-50 -translate-y-1/2">
        <Image 
          src="/fonts/logo.png" 
          alt="EndSec" 
          width={180} 
          height={60} 
          className="h-12 w-auto"
        />
      </div>
      
      <div className="min-h-screen flex flex-col items-center pt-[25vh] p-4 bg-dark">
        <div className="w-full max-w-3xl space-y-12">
          <div className="text-center space-y-4">
            <h1 className="text-7xl md:text-8xl font-title font-normal tracking-tight text-white">EndSec</h1>
            <p className="text-lg text-gray-400">
            Your research copilot for SEC filings
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="w-full">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                {/* Input with dropdown */}
                <div className="flex h-14 bg-input-bg border border-white/20 focus-within:border-white transition-colors">
                  {/* Dropdown Trigger */}
                  <div ref={dropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="h-full px-4 flex items-center gap-2 text-gray-400 hover:text-white border-r border-white/20 transition-colors bg-transparent"
                    >
                      <span className="text-sm font-medium min-w-[52px]">{currentMode.label}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 bg-input-bg border border-white/20 z-50 min-w-[120px]">
                        {SEARCH_MODES.map((mode) => (
                          <button
                            key={mode.value}
                            type="button"
                            onClick={() => handleModeChange(mode.value)}
                            className={`w-full px-4 py-3 text-left text-sm hover:bg-white/10 transition-colors ${
                              searchMode === mode.value ? 'text-brand-teal' : 'text-gray-300'
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Input Field */}
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={currentMode.placeholder}
                    className="flex-1 h-full px-4 bg-transparent text-white placeholder:text-gray-500 focus:outline-none"
                  />
                </div>
                
                {validationError && (
                  <p className="absolute -bottom-6 left-0 text-sm text-destructive">{validationError}</p>
                )}
              </div>
              <Button 
                type="submit" 
                className="h-14 px-8 rounded-none bg-white text-dark hover:bg-brand-teal hover:text-white transition-all duration-300 font-medium text-lg"
              >
                {searchMode === "url" ? "Analyze Filing" : "Browse Filings"}
              </Button>
            </div>
          </form>
        </div>
      </div>
      
      <HeatmapGrid />
    </>
  )
}
