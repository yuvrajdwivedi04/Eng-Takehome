/**
 * Short URL redirect handler
 * 
 * Handles /u/<encoded> URLs by decoding the path segment
 * and redirecting to the full viewer URL.
 * 
 * This provides a cleaner shareable URL format:
 *   /u/https%3A%2F%2Fwww.sec.gov%2F...
 * Instead of:
 *   /view?source=https%3A%2F%2Fwww.sec.gov%2F...
 * 
 * Hash fragments are preserved separately to ensure deep-link
 * highlighting works correctly (fragments must stay literal, not encoded).
 */
import { redirect } from "next/navigation"

interface ShortUrlPageProps {
  params: Promise<{ encoded: string }>
}

export default async function ShortUrlPage({ params }: ShortUrlPageProps) {
  const { encoded } = await params
  const decoded = decodeURIComponent(encoded)
  
  // Preserve hash fragments for deep-link highlighting
  // Fragment must stay literal (not double-encoded) for CSS Highlight API
  const [base, fragment] = decoded.split("#")
  const redirectUrl = `/view?source=${encodeURIComponent(base)}${fragment ? `#${fragment}` : ""}`
  
  redirect(redirectUrl)
}

