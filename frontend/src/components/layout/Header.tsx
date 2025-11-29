"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Menu, Download, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getAllTablesXlsxUrl, getAllTablesCsvZipUrl } from "@/lib/api"

interface HeaderProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  filingId?: string | null
}

export function Header({ onToggleSidebar, filingId }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="flex items-center h-14 px-4 border-b border-white/10 bg-dark text-white">
      {/* Left: menu + logo */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="mr-2 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-2">
        <span className="font-title text-xl">EndSec</span>
        <span className="text-gray-400 text-sm">by</span>
        <Image 
          src="/fonts/logo.png" 
          alt="Endex" 
          width={150} 
          height={48} 
          className="h-9 w-auto opacity-80"
        />
      </div>

      {/* Center: Download All Tables dropdown */}
      <div className="flex-1 flex justify-center">
        {filingId && (
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Download All Tables
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
            {dropdownOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-dark border border-white/20 shadow-lg z-50 min-w-[140px]">
                <button
                  onClick={() => {
                    window.location.href = getAllTablesXlsxUrl(filingId)
                    setDropdownOpen(false)
                  }}
                  className="block w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-white/10 transition-colors"
                >
                  Excel (.xlsx)
                </button>
                <button
                  onClick={() => {
                    window.location.href = getAllTablesCsvZipUrl(filingId)
                    setDropdownOpen(false)
                  }}
                  className="block w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-white/10 transition-colors"
                >
                  CSV (.zip)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right spacer for visual balance */}
      <div className="w-32" />
    </div>
  )
}

