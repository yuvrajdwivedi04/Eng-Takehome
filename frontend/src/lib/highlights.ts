import { Selection } from "./selection-utils"

export interface StoredHighlight {
  id: string
  filingId: string
  filingUrl: string
  selection: Selection
  snippet: string
  createdAt: number
}

const USER_ID_KEY = "endex_user_id"

/**
 * Generate or retrieve a persistent user ID from localStorage.
 * This allows highlights to persist across sessions for the same user.
 */
export function getUserId(): string {
  if (typeof window === "undefined") return "ssr"
  
  let id = localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}

/**
 * Storage key combines user ID and filing ID for per-user, per-filing scoping.
 */
function getStorageKey(filingId: string): string {
  return `endex_highlights_${getUserId()}_${filingId}`
}

/**
 * Create a deterministic key from a selection for deduplication.
 */
function getSelectionKey(selection: Selection): string {
  return JSON.stringify(selection)
}

/**
 * Retrieve all highlights for a specific filing.
 */
export function getHighlights(filingId: string): StoredHighlight[] {
  if (typeof window === "undefined") return []
  
  try {
    const raw = localStorage.getItem(getStorageKey(filingId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Save a highlight to localStorage.
 * Deduplicates by selection content - re-saving the same selection updates it.
 */
export function saveHighlight(highlight: StoredHighlight): void {
  if (typeof window === "undefined") return
  
  const existing = getHighlights(highlight.filingId)
  const selectionKey = getSelectionKey(highlight.selection)
  
  // Remove any existing highlight with the same selection (prevents duplicates)
  const filtered = existing.filter(h => getSelectionKey(h.selection) !== selectionKey)
  
  // Add the new/updated highlight
  localStorage.setItem(
    getStorageKey(highlight.filingId),
    JSON.stringify([...filtered, highlight])
  )
}

/**
 * Delete a specific highlight by ID.
 */
export function deleteHighlight(filingId: string, highlightId: string): void {
  if (typeof window === "undefined") return
  
  const existing = getHighlights(filingId)
  const filtered = existing.filter(h => h.id !== highlightId)
  localStorage.setItem(getStorageKey(filingId), JSON.stringify(filtered))
}

/**
 * Factory function to create a new highlight object.
 */
export function createHighlight(
  filingId: string,
  filingUrl: string,
  selection: Selection,
  snippet: string
): StoredHighlight {
  return {
    id: crypto.randomUUID(),
    filingId,
    filingUrl,
    selection,
    snippet: snippet.slice(0, 100),
    createdAt: Date.now()
  }
}

