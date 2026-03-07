export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"

import CaptureHubClient from "../../components/capture/CaptureHubClient"

type CapturePageProps = {
  searchParams: Promise<{
    project?: string
  }>
}

export default async function CapturePage({ searchParams }: CapturePageProps) {
  const params = await searchParams
  if (params.project) return <CaptureHubClient projectId={params.project} />

  redirect("/projects?flow=load")
}
