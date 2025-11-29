"use client"

import { useState, useEffect, useRef } from "react"
import { MapPin } from "lucide-react"

interface NavigationToastProps {
  onComplete?: () => void
}

export function NavigationToast({ onComplete }: NavigationToastProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isExiting, setIsExiting] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const toastRef = useRef<HTMLDivElement>(null)

  // Calculate position based on the main scroll container
  useEffect(() => {
    const mainElement = document.querySelector('main')
    if (mainElement) {
      const rect = mainElement.getBoundingClientRect()
      setPosition({
        left: rect.left + rect.width / 2,
        top: rect.top + 24
      })
    }
  }, [])

  useEffect(() => {
    // Start exit animation after 2.5s
    const exitTimer = setTimeout(() => {
      setIsExiting(true)
    }, 2500)

    // Fully hide after exit animation completes (2.5s + 0.3s)
    const hideTimer = setTimeout(() => {
      setIsVisible(false)
      onComplete?.()
    }, 2800)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(hideTimer)
    }
  }, [onComplete])

  if (!isVisible || !position) return null

  return (
    <div
      ref={toastRef}
      className={`fixed z-50 px-4 py-2.5 bg-dark border border-white/20 shadow-lg flex items-center gap-2 -translate-x-1/2 ${
        isExiting ? "animate-toast-out-top" : "animate-toast-in-top"
      }`}
      style={{
        left: position.left,
        top: position.top
      }}
    >
      <MapPin className="w-4 h-4 text-brand-teal" />
      <span className="text-sm text-gray-300">Taking you to the highlighted section...</span>
    </div>
  )
}

