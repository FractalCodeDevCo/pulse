import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Pulse",
  description: "Field evidence capture for turf installation",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
