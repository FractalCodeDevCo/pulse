export const dynamic = "force-dynamic"

import RollInstallationPageClient from "../../../components/pulse/RollInstallationPageClient"

type RollInstallationPageProps = {
  searchParams: Promise<{
    project?: string
    projectZoneId?: string
    fieldType?: string
    macroZone?: string
    microZone?: string
    zoneType?: string
    prefill?: string
  }>
}

export default async function RollInstallationPage({ searchParams }: RollInstallationPageProps) {
  const params = await searchParams
  return (
    <RollInstallationPageClient
      projectId={params.project ?? null}
      projectZoneId={params.projectZoneId ?? null}
      fieldType={params.fieldType ?? null}
      macroZone={params.macroZone ?? null}
      microZone={params.microZone ?? null}
      zoneType={params.zoneType ?? null}
      prefillFromZone={params.prefill === "1"}
    />
  )
}
