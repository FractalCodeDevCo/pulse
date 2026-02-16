export const dynamic = "force-dynamic"

import MaterialPageClient from "../../../components/material/MaterialPageClient"

type MaterialPageProps = {
  searchParams: Promise<{
    project?: string
  }>
}

export default async function MaterialPage({ searchParams }: MaterialPageProps) {
  const params = await searchParams
  const projectId = params.project ?? null

  return <MaterialPageClient projectId={projectId} />
}
