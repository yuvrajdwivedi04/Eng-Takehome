import { Source } from "@/lib/chat-api"
import { FileText } from "lucide-react"

interface SourceCardProps {
  source: Source
  index: number
  onClick: (elementIndex: number) => void
}

export function SourceCard({ source, index, onClick }: SourceCardProps) {
  return (
    <button
      onClick={() => onClick(source.elementIndex)}
      className="w-full text-left p-3 rounded-md border border-white/10 hover:border-brand-teal/50 hover:bg-white/5 transition-all group"
    >
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-5 h-5 rounded bg-brand-teal/20 text-brand-teal flex items-center justify-center text-xs font-medium">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-300 line-clamp-2 group-hover:text-white transition-colors">
            {source.preview}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <FileText className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-500">
              Click to view in document
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

