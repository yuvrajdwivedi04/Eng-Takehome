import { FilingSection } from "@/components/viewer/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface SidebarProps {
  sections: FilingSection[]
  isOpen: boolean
  activeSection: string | null
}

export function Sidebar({ sections, isOpen, activeSection }: SidebarProps) {
  if (!isOpen) {
    return null
  }

  const handleSectionClick = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const getIndentStyle = (level: number) => {
    const baseIndent = 0.5 // rem
    return { paddingLeft: `${baseIndent + (level - 1) * 0.75}rem` }
  }

  if (sections.length === 0) {
    return (
      <aside className="w-64 border-r bg-muted/10 h-full">
        <ScrollArea className="h-full">
          <div className="p-4">
            <h2 className="text-sm font-semibold mb-4 text-muted-foreground">Contents</h2>
            <p className="text-sm text-muted-foreground">No sections found in this filing.</p>
          </div>
        </ScrollArea>
      </aside>
    )
  }

  return (
    <aside className="w-64 border-r bg-muted/10 h-full">
      <ScrollArea className="h-full">
        <div className="p-4">
          <h2 className="text-sm font-semibold mb-4 text-muted-foreground">Contents</h2>
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => handleSectionClick(section.id)}
                style={getIndentStyle(section.level)}
                className={cn(
                  "w-full text-left text-sm py-1.5 rounded-md hover:bg-accent transition-all border-l-2 border-transparent",
                  section.id === activeSection && "text-primary bg-primary/10 border-primary"
                )}
              >
                {section.text}
              </button>
            ))}
          </nav>
        </div>
      </ScrollArea>
    </aside>
  )
}

