import { ReactNode, forwardRef } from "react"

interface ViewerLayoutProps {
  header: ReactNode
  sidebar: ReactNode
  content: ReactNode
  chat?: ReactNode
}

export const ViewerLayout = forwardRef<HTMLElement, ViewerLayoutProps>(
  function ViewerLayout({ header, sidebar, content, chat }, ref) {
    return (
      <div className="h-screen flex flex-col bg-dark">
        {header}
        <div className="flex-1 flex overflow-hidden">
          <div className="h-full">
            {sidebar}
          </div>
          <main ref={ref} className="flex-1 overflow-y-auto relative scrollbar-teal">
            {content}
          </main>
          {chat && <div className="h-full">{chat}</div>}
        </div>
      </div>
    )
  }
)

