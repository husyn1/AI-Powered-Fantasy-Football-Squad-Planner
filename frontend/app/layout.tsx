import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "FPL Season Brain",
  description: "Analyse your FPL season with persistent memory and ML insights",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
