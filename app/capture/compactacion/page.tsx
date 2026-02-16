export const dynamic = "force-dynamic"

import CompactacionPageClient from "../../../components/compactacion/CompactacionPageClient"

type CompactacionPageProps = {
  searchParams: Promise<{
    project?: string
  }>
}

export default async function CompactacionPage({ searchParams }: CompactacionPageProps) {
  const params = await searchParams
  return <CompactacionPageClient projectId={params.project ?? null} />
}
