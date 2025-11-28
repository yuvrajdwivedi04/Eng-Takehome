import { Menu, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface HeaderProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  isChatOpen: boolean
  onToggleChat: () => void
}

export function Header({ onToggleSidebar, isChatOpen, onToggleChat }: HeaderProps) {
  return (
    <>
      <div className="flex items-center h-14 px-4 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="mr-2"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Endex</h1>
        <div className="ml-auto">
          <Button
            variant={isChatOpen ? "default" : "ghost"}
            size="icon"
            onClick={onToggleChat}
            aria-label="Toggle chat"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </>
  )
}

