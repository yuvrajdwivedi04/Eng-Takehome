import { Source } from "@/lib/chat-api"

export interface ParsedSegment {
  type: "text" | "citation"
  content: string
  citationIndex?: number // 1-based for citations
}

/**
 * Parses message content and extracts inline citations like [1], [2], [1][2]
 * Returns an array of segments for rendering
 */
export function parseCitations(content: string): ParsedSegment[] {
  const segments: ParsedSegment[] = []
  const citationRegex = /\[(\d+)\]/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = citationRegex.exec(content)) !== null) {
    // Add text before this citation
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      })
    }

    // Add citation
    segments.push({
      type: "citation",
      content: match[0],
      citationIndex: parseInt(match[1], 10),
    })

    lastIndex = citationRegex.lastIndex
  }

  // Add remaining text after last citation
  if (lastIndex < content.length) {
    segments.push({
      type: "text",
      content: content.slice(lastIndex),
    })
  }

  return segments
}

/**
 * Maps a 1-based citation index to the corresponding Source object
 * Returns undefined if the index is out of bounds
 */
export function getSourceByCitation(
  citationIndex: number,
  sources: Source[]
): Source | undefined {
  // Citations are 1-based, array is 0-based
  const arrayIndex = citationIndex - 1
  if (arrayIndex < 0 || arrayIndex >= sources.length) {
    return undefined
  }
  return sources[arrayIndex]
}

