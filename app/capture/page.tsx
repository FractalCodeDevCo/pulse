export const dynamic = "force-dynamic"

import CaptureHubClient from "../../components/capture/CaptureHubClient"

type CapturePageProps = {
  searchParams: Promise<{
    project?: string
  }>
}

export default async function CapturePage({ searchParams }: CapturePageProps) {
  const params = await searchParams
  return <CaptureHubClient projectId={params.project ?? null} />
}
