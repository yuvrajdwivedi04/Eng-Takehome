"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FrameGrid } from "@/components/ui/FrameGrid"
import { HeatmapGrid } from "@/components/home/HeatmapGrid"

export default function Home() {
  const [url, setUrl] = useState("")
  const [validationError, setValidationError] = useState("")
  const router = useRouter()

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) {
      setValidationError("Please enter a URL")
      return false
    }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setValidationError("URL must start with http:// or https://")
      return false
    }
    setValidationError("")
    return true
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateUrl(url)) {
      return
    }

    router.push(`/view?source=${encodeURIComponent(url)}`)
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
                <Input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.sec.gov/..."
                  className="w-full h-14 px-6 rounded-none bg-input-bg border-white/20 focus:border-white text-white placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
                />
                {validationError && (
                  <p className="absolute -bottom-6 left-0 text-sm text-destructive">{validationError}</p>
                )}
              </div>
              <Button 
                type="submit" 
                className="h-14 px-8 rounded-none bg-white text-dark hover:bg-brand-teal hover:text-white transition-all duration-300 font-medium text-lg"
              >
                Analyze Filing
              </Button>
            </div>
          </form>
        </div>
      </div>
      
      <HeatmapGrid />
    </>
  )
}
