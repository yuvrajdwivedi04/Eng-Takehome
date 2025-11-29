import Image from "next/image"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

export function Header({ onToggleSidebar }: HeaderProps) {
  return (
    <div className="flex items-center h-14 px-4 border-b border-white/10 bg-dark text-white">
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
    </div>
  )
}

