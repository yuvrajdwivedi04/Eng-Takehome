import { FilingSection } from "@/components/viewer/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface SidebarProps {
  sections: FilingSection[]
  isOpen: boolean
  activeSection: string | null
}

export function Sidebar({ sections, isOpen, activeSection }: SidebarProps) {
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

  return (
    <aside 
      className={cn(
        "border-r border-white/10 bg-dark h-full overflow-hidden transition-all duration-300 ease-in-out relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.25)]",
        isOpen ? "w-64" : "w-0 border-r-0"
      )}
    >
      <div className="w-64 h-full">
        <ScrollArea className="h-full">
          <div className="p-4">
            <h2 className="text-sm font-semibold mb-4 text-gray-400">Contents</h2>
            {sections.length === 0 ? (
              <p className="text-sm text-gray-500">No sections found in this filing.</p>
            ) : (
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => handleSectionClick(section.id)}
                    style={getIndentStyle(section.level)}
                    className={cn(
                      "w-full text-left text-sm py-1.5 rounded-none transition-all border-l-2 border-transparent",
                      "text-gray-400 hover:bg-white/5 hover:text-gray-200",
                      section.id === activeSection && "text-brand-teal bg-brand-teal/5 border-brand-teal font-medium"
                    )}
                  >
                    {section.text}
                  </button>
                ))}
              </nav>
            )}
          </div>
        </ScrollArea>
      </div>
    </aside>
  )
}

