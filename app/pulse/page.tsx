export const dynamic = "force-dynamic"

import ZoneHubClient from "../../components/pulse/ZoneHubClient"

type PulsePageProps = {
  searchParams: Promise<{
    project?: string
  }>
}

export default async function PulsePage({ searchParams }: PulsePageProps) {
  const params = await searchParams
  return <ZoneHubClient projectId={params.project ?? null} />
}
