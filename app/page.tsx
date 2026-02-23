import Link from "next/link"

import SiteShell from "../components/site/SiteShell"

export default function HomePage() {
  return (
    <SiteShell
      title="Infrastructure for Financial Optimization in Sports Construction."
      subtitle="Structured capture, operational intelligence, and margin protection for turf installation programs."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg text-slate-100">The Problem</h2>
          <p className="mt-2 text-sm text-slate-300">
            Margin erosion from rework, inconsistent field execution, and no standardized variance signal.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg text-slate-100">The System</h2>
          <p className="mt-2 text-sm text-slate-300">
            Zone-based capture, evidence traceability, and baseline-driven deviation metrics from day one.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg text-slate-100">The Advantage</h2>
          <p className="mt-2 text-sm text-slate-300">
            Reduced retrabajo, tighter adhesive control, and an operational dataset ready for forecasting.
          </p>
        </article>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-6">
          <h3 className="font-heading text-xl text-slate-100">For Field Operations</h3>
          <p className="mt-2 text-sm text-slate-300">
            Capture by project and zone with minimal friction on mobile, even under active installation flow.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/projects?flow=load"
              className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-cyan-700"
            >
              Open Pulse
            </Link>
            <Link
              href="/projects?flow=new"
              className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-900"
            >
              Create Project
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-6">
          <h3 className="font-heading text-xl text-slate-100">For Executives</h3>
          <p className="mt-2 text-sm text-slate-300">
            Operational variance visibility by zone with technical evidence that supports contract-level decisions.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/enterprise"
              className="rounded-lg border border-cyan-500/70 px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/10"
            >
              Enterprise Brief
            </Link>
            <Link
              href="/contact"
              className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-900"
            >
              Schedule Technical Briefing
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
