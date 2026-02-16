"use client"

export const dynamic = "force-dynamic"

import { useState } from "react"

import CompactacionPageClient from "../../../components/compactacion/CompactacionPageClient"

function getProjectIdFromUrl(): string | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  return params.get("project")
}

export default function CompactacionPage() {
  const [projectId] = useState<string | null>(() => getProjectIdFromUrl())
  return <CompactacionPageClient projectId={projectId} />
}
