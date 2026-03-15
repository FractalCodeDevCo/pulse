export const dynamic = "force-dynamic"

import ZoneDetailPageClient from "../../../../components/pulse/ZoneDetailPageClient"

type ZonePageProps = {
  params: Promise<{
    projectZoneId: string
  }>
  searchParams: Promise<{
    project?: string
  }>
}

export default async function ZonePage({ params, searchParams }: ZonePageProps) {
  const [{ projectZoneId }, query] = await Promise.all([params, searchParams])
  return <ZoneDetailPageClient projectId={query.project ?? null} projectZoneId={projectZoneId} />
}
