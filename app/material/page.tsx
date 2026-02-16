export const dynamic = "force-dynamic"

import MaterialModulePage from "../../components/material/MaterialModulePage"

type MaterialPageProps = {
  searchParams: Promise<{
    project?: string
  }>
}

export default async function MaterialPage({ searchParams }: MaterialPageProps) {
  const params = await searchParams
  return <MaterialModulePage projectId={params.project ?? null} />
}
