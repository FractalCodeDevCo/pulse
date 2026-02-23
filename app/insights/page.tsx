import SiteShell from "../../components/site/SiteShell"

const papers = [
  {
    title: "Zone-Based Adhesive Variance Framework",
    summary: "EWMA baseline methodology for early detection of adhesive overuse by zone type.",
  },
  {
    title: "Risk Scoring for Roll Installation and Compaction",
    summary: "Simple weighted model to expose operational risk before retrabajo propagates.",
  },
  {
    title: "Structured Capture Schema for Sports Construction",
    summary: "Data model designed for reproducible analysis and financial projection workflows.",
  },
]

export default function InsightsPage() {
  return (
    <SiteShell
      title="Field Technical Insights."
      subtitle="Technical notes and applied modeling frameworks for sports construction performance control."
    >
      <section className="space-y-4">
        {papers.map((paper) => (
          <article key={paper.title} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="font-heading text-lg text-slate-100">{paper.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{paper.summary}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">Internal Technical Brief</p>
          </article>
        ))}
      </section>
    </SiteShell>
  )
}
