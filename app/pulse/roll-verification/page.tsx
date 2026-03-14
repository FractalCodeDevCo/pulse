export const dynamic = "force-dynamic"

import RollVerificationPageClient from "../../../components/pulse/RollVerificationPageClient"

type RollVerificationPageProps = {
  searchParams: Promise<{
    project?: string
    projectZoneId?: string
    fieldType?: string
    macroZone?: string
    microZone?: string
    zoneType?: string
  }>
}

export default async function RollVerificationPage({ searchParams }: RollVerificationPageProps) {
  const params = await searchParams
  return (
    <RollVerificationPageClient
      projectId={params.project ?? null}
      projectZoneId={params.projectZoneId ?? null}
      fieldType={params.fieldType ?? null}
      macroZone={params.macroZone ?? null}
      microZone={params.microZone ?? null}
      zoneType={params.zoneType ?? null}
    />
  )
}
