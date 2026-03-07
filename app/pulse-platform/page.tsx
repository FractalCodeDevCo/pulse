import Link from "next/link"

import SiteShell from "../../components/site/SiteShell"

export default function PulsePlatformPage() {
  return (
    <SiteShell
      title="Pulse: Field Capture Engine."
      subtitle="Mobile-first operational capture for roll installation, pegada, material passes, and incident traceability."
    >
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg">Zone Workflow</h2>
          <p className="mt-2 text-sm text-slate-300">
            Capture is organized by project and zone, with process steps aligned to real installation flow.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg">Resilient Capture</h2>
          <p className="mt-2 text-sm text-slate-300">
            Draft autosave keeps photos and questionnaires recoverable when refresh or connection interruptions happen.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg">Computed Summaries</h2>
          <p className="mt-2 text-sm text-slate-300">
            Each save returns immediate summary cards for deviation and risk without exposing complex math to field crews.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg">Cloud Persistence</h2>
          <p className="mt-2 text-sm text-slate-300">
            Supabase-backed records and storage URLs provide auditable history per zone and per project.
          </p>
        </article>
      </section>

      <div className="mt-8">
        <Link
          href="/contact"
          className="inline-flex rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-cyan-700"
        >
          Request Project Evaluation
        </Link>
      </div>
    </SiteShell>
  )
}
