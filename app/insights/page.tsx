import SiteShell from "../../components/site/SiteShell"
import Link from "next/link"

import { getSupabaseAdminClient } from "../../lib/supabase/server"

const fallbackPapers = [
  {
    slug: "zone-based-adhesive-variance-framework",
    title: "Zone-Based Adhesive Variance Framework",
    summary: "EWMA baseline methodology for early detection of adhesive overuse by zone type.",
  },
  {
    slug: "risk-scoring-roll-installation-compaction",
    title: "Risk Scoring for Roll Installation and Compaction",
    summary: "Simple weighted model to expose operational risk before retrabajo propagates.",
  },
  {
    slug: "structured-capture-schema-sports-construction",
    title: "Structured Capture Schema for Sports Construction",
    summary: "Data model designed for reproducible analysis and financial projection workflows.",
  },
]

type InsightRow = {
  id: string
  slug: string
  title: string
  summary: string
  status: "draft" | "published"
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  return (error as { code?: string }).code === "42P01"
}

export default async function InsightsPage() {
  let papers = fallbackPapers
  let warning = ""

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("technical_insights")
      .select("id,slug,title,summary,status")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      if (isMissingRelationError(error)) {
        warning = "Activa technical_insights en Supabase para publicar artículos desde admin."
      } else {
        warning = error.message
      }
    } else if ((data ?? []).length > 0) {
      papers = (data as InsightRow[]).map((item) => ({
        slug: item.slug,
        title: item.title,
        summary: item.summary,
      }))
    }
  } catch (error) {
    warning = error instanceof Error ? error.message : "No se pudieron cargar insights."
  }

  return (
    <SiteShell
      title="Field Technical Insights."
      subtitle="Technical notes and applied modeling frameworks for sports construction performance control."
    >
      <section className="mb-4 flex items-center justify-end">
        <Link
          href="/insights/admin"
          className="rounded-lg border border-amber-500/70 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10"
        >
          Manage Insights
        </Link>
      </section>
      {warning ? (
        <section className="mb-4 rounded-2xl border border-amber-500/70 bg-amber-500/10 p-4 text-sm text-amber-200">
          {warning}
        </section>
      ) : null}
      <section className="space-y-4">
        {papers.map((paper) => (
          <article key={paper.title} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="font-heading text-lg text-slate-100">{paper.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{paper.summary}</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Internal Technical Brief</p>
              <Link href={`/insights/${encodeURIComponent(paper.slug)}`} className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                Leer artículo
              </Link>
            </div>
          </article>
        ))}
      </section>
    </SiteShell>
  )
}
