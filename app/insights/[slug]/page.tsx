import Link from "next/link"
import { notFound } from "next/navigation"

import SiteShell from "../../../components/site/SiteShell"
import { getSupabaseAdminClient } from "../../../lib/supabase/server"

export const dynamic = "force-dynamic"

type InsightDetailPageProps = {
  params: Promise<{
    slug: string
  }>
}

type InsightRow = {
  slug: string
  title: string
  summary: string
  body: string
  status: "draft" | "published"
  created_at: string
  updated_at: string
}

function asParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

export default async function InsightDetailPage({ params }: InsightDetailPageProps) {
  const { slug } = await params
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from("technical_insights")
    .select("slug,title,summary,body,status,created_at,updated_at")
    .eq("slug", slug)
    .eq("status", "published")
    .limit(1)

  if (error || !data || data.length === 0) {
    notFound()
  }

  const insight = data[0] as InsightRow
  const paragraphs = asParagraphs(insight.body)

  return (
    <SiteShell title={insight.title} subtitle={insight.summary}>
      <section className="mb-4">
        <Link href="/insights" className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-900">
          Back to Insights
        </Link>
      </section>

      <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
        {paragraphs.length === 0 ? (
          <p className="text-slate-300">Este artículo no tiene cuerpo todavía. Edita desde Insights Admin y publícalo.</p>
        ) : (
          <div className="space-y-4">
            {paragraphs.map((paragraph, index) => (
              <p key={`${insight.slug}-${index}`} className="leading-relaxed text-slate-200">
                {paragraph}
              </p>
            ))}
          </div>
        )}
        <p className="mt-6 text-xs uppercase tracking-[0.16em] text-slate-500">
          Updated {new Date(insight.updated_at).toLocaleDateString("es-MX")}
        </p>
      </article>
    </SiteShell>
  )
}
