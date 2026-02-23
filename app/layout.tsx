import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "FractalBuild | Industrial Sports Construction Intelligence",
  description: "Structured operational intelligence for sports field construction.",
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
