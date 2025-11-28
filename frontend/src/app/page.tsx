"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Endex</h1>
          <p className="text-muted-foreground">
            Paste any SEC filing URL to begin
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.sec.gov/..."
              className="w-full"
            />
            {validationError && (
              <p className="text-sm text-destructive">{validationError}</p>
            )}
          </div>
          <Button type="submit" className="w-full" size="lg">
            Analyze Filing
          </Button>
        </form>
      </div>
    </div>
  )
}

