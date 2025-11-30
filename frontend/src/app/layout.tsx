import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    default: "EndSec by Endex | Your research copilot for SEC filings",
    template: "%s | EndSec",
  },
  description: "Research SEC filings faster with AI-powered analysis. Browse 10-K, 10-Q, 8-K filings with intelligent chat, table exports, and document navigation.",
  icons: {
    icon: "/fonts/favicon.jpeg",
  },
  openGraph: {
    title: "EndSec by Endex",
    description: "Your research copilot for SEC filings",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "EndSec by Endex",
    description: "Your research copilot for SEC filings",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-dark">{children}</body>
    </html>
  )
}
