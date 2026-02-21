export const dynamic = "force-dynamic"

import ProjectHistoryClient from "../../../components/pulse/ProjectHistoryClient"

type HistoryPageProps = {
  searchParams: Promise<{
    project?: string
    macroZone?: string
    microZone?: string
  }>
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams
  const zoneKey =
    params.macroZone && params.microZone ? `${params.macroZone}::${params.microZone}` : null

  return <ProjectHistoryClient projectId={params.project ?? null} initialZoneKey={zoneKey} />
}
