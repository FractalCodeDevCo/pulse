export const dynamic = "force-dynamic"

import CaptureHubClient from "../../components/capture/CaptureHubClient"

type PulsePageProps = {
  searchParams: Promise<{
    project?: string
  }>
}

export default async function PulsePage({ searchParams }: PulsePageProps) {
  const params = await searchParams
  return <CaptureHubClient projectId={params.project ?? null} />
}
