export const dynamic = "force-dynamic"

import MaterialModulePage from "../../../components/material/MaterialModulePage"

type MaterialCapturePageProps = {
  searchParams: Promise<{
    project?: string
    projectZoneId?: string
  }>
}

export default async function MaterialCapturePage({ searchParams }: MaterialCapturePageProps) {
  const params = await searchParams
  return <MaterialModulePage projectId={params.project ?? null} projectZoneId={params.projectZoneId ?? null} />
}
