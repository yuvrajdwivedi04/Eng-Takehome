export interface TextSelection {
  type: "text"
  elementIndex: number
  startOffset: number
  endOffset: number
}

export interface TableSelection {
  type: "table"
  tableIndex: number
  startRow?: number
  startCol?: number
  endRow?: number
  endCol?: number
}

export type Selection = TextSelection | TableSelection

export function parseSelectionFromUrl(searchParams: URLSearchParams): Selection | null {
  const encoded = searchParams.get("selection")
  if (!encoded) return null
  
  try {
    const decoded = atob(encoded)
    const parsed = JSON.parse(decoded)
    
    if (!isValidSelection(parsed)) {
      console.warn("Invalid selection descriptor in URL:", parsed)
      return null
    }
    
    return parsed as Selection
  } catch (error) {
    console.warn("Failed to parse selection from URL:", error)
    return null
  }
}

export function encodeSelectionToUrl(selection: Selection): string {
  const json = JSON.stringify(selection)
  return btoa(json)
}

export function isValidSelection(obj: any): obj is Selection {
  if (!obj || typeof obj !== "object") return false
  
  if (obj.type === "text") {
    return (
      typeof obj.elementIndex === "number" &&
      typeof obj.startOffset === "number" &&
      typeof obj.endOffset === "number" &&
      obj.elementIndex >= 0 &&
      obj.startOffset >= 0 &&
      obj.endOffset >= obj.startOffset
    )
  }
  
  if (obj.type === "table") {
    return (
      typeof obj.tableIndex === "number" &&
      obj.tableIndex >= 0
    )
  }
  
  return false
}

export function getShareableUrl(
  filingUrl: string,
  selection: Selection,
  baseUrl: string = window.location.origin
): string {
  const encoded = encodeSelectionToUrl(selection)
  const url = new URL(`${baseUrl}/view`)
  url.searchParams.set("source", filingUrl)
  url.searchParams.set("selection", encoded)
  return url.toString()
}



