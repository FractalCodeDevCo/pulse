export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"

type CapturePageProps = {
  searchParams: Promise<{
    project?: string
  }>
}

export default async function CapturePage({ searchParams }: CapturePageProps) {
  const params = await searchParams
  if (params.project) {
    redirect(`/pulse?project=${encodeURIComponent(params.project)}`)
  }

  redirect("/projects?flow=load")
}
