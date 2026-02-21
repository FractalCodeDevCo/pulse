export const dynamic = "force-dynamic"

import RollVerificationPageClient from "../../../components/pulse/RollVerificationPageClient"

type RollVerificationPageProps = {
  searchParams: Promise<{
    project?: string
  }>
}

export default async function RollVerificationPage({ searchParams }: RollVerificationPageProps) {
  const params = await searchParams
  return <RollVerificationPageClient projectId={params.project ?? null} />
}
