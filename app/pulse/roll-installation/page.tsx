export const dynamic = "force-dynamic"

import RollInstallationPageClient from "../../../components/pulse/RollInstallationPageClient"

type RollInstallationPageProps = {
  searchParams: Promise<{
    project?: string
  }>
}

export default async function RollInstallationPage({ searchParams }: RollInstallationPageProps) {
  const params = await searchParams
  return <RollInstallationPageClient projectId={params.project ?? null} />
}
