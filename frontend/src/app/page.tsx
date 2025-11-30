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
  const [isInputFocused, setIsInputFocused] = useState(false)
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
      
      <div className="min-h-screen flex flex-col items-center pt-[25vh] p-4 relative z-10">
        <div className="w-full max-w-3xl space-y-12">
          {/* Title section with staggered fade-up animation */}
          <div className="text-center space-y-4">
            <h1 
              className="text-7xl md:text-8xl font-title font-normal tracking-tight text-white opacity-0 animate-slide-up-fade"
              style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}
            >
              EndSec
            </h1>
            <p 
              className="text-lg text-gray-400 opacity-0 animate-slide-up-fade"
              style={{ animationDelay: '350ms', animationFillMode: 'forwards' }}
            >
              Your research copilot for SEC filings
            </p>
          </div>
          
          {/* Form with fade-up animation */}
          <form 
            onSubmit={handleSubmit} 
            className="w-full opacity-0 animate-slide-up-fade"
            style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}
          >
            <div className="flex flex-col md:flex-row gap-3 items-center md:items-stretch">
              <div className="flex-1 relative w-full">
                {/* Input with dropdown */}
                <div className={`flex h-14 bg-input-bg border transition-all duration-300 ease-out ${
                  isInputFocused ? 'border-white/80' : 'border-white/20'
                }`}>
                  {/* Dropdown Trigger - Fixed width to prevent layout shift between URL/Ticker/CIK */}
                  <div ref={dropdownRef} className="relative flex w-[100px]">
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full h-full px-3 flex items-center justify-between text-gray-400 hover:text-white border-r border-white/20 transition-all duration-300 bg-transparent"
                    >
                      <span className="text-sm font-medium">{currentMode.label}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform duration-300 ease-out ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Dropdown Menu */}
                    <div 
                      className={`absolute top-full left-0 w-full bg-input-bg border border-white/20 z-50 origin-top transition-all duration-200 ease-out ${
                        isDropdownOpen 
                          ? 'opacity-100 transform scale-y-100 translate-y-0' 
                          : 'opacity-0 transform scale-y-95 -translate-y-1 pointer-events-none'
                      }`}
                    >
                      {SEARCH_MODES.map((mode) => (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => handleModeChange(mode.value)}
                          className={`w-full px-4 py-3 text-left text-sm hover:bg-white/10 transition-all duration-200 ${
                            searchMode === mode.value ? 'text-brand-teal' : 'text-gray-300'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Input Field */}
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
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
                className="h-14 w-[160px] rounded-none bg-white text-dark hover:bg-brand-teal hover:text-white transition-all duration-300 font-medium text-lg"
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
