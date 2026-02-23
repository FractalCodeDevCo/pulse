import Link from "next/link"

import BlueprintSection from "../components/site/BlueprintSection"
import SiteShell from "../components/site/SiteShell"

export default function HomePage() {
  return (
    <SiteShell
      title="Structured Operational Intelligence System."
      subtitle="Zone normalization, process integrity, and margin protection for sports construction."
    >
      <section className="flex flex-wrap gap-3">
        <Link
          href="/contact"
          className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-cyan-700"
        >
          Request Technical Brief
        </Link>
        <Link
          href="/contact"
          className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-900"
        >
          Request Project Evaluation
        </Link>
        <Link
          href="/contact"
          className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-900"
        >
          Request Consultation
        </Link>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg text-slate-100">Problem</h2>
          <p className="mt-2 text-sm text-slate-300">
            Rework, variance blind spots, and margin leakage in sports field execution.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg text-slate-100">System</h2>
          <p className="mt-2 text-sm text-slate-300">
            Zone-structured capture and process checkpoints with traceable technical evidence.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg text-slate-100">Advantage</h2>
          <p className="mt-2 text-sm text-slate-300">
            Controlled execution quality and a stable operational dataset for strategic planning.
          </p>
        </article>
      </section>

      <BlueprintSection />

      <section className="mt-10">
        <h2 className="font-heading text-2xl text-slate-100 md:text-3xl">Operational Architecture</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h3 className="font-heading text-lg">Operational Normalization</h3>
            <p className="mt-2 text-sm text-slate-300">Consistent zone structure and process language across projects.</p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h3 className="font-heading text-lg">Traceable Evidence Layer</h3>
            <p className="mt-2 text-sm text-slate-300">Capture records linked to project, zone, timestamp, and evidence.</p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h3 className="font-heading text-lg">Deviation Modeling</h3>
            <p className="mt-2 text-sm text-slate-300">Structured variance detection for process stability and quality control.</p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h3 className="font-heading text-lg">Financial Projection Readiness</h3>
            <p className="mt-2 text-sm text-slate-300">Schema-ready operational history designed for forecasting and analytics.</p>
          </article>
        </div>
      </section>

      <section className="mt-10 rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-6 md:p-7">
        <h2 className="font-heading text-2xl text-cyan-100 md:text-3xl">Schedule Technical Briefing</h2>
        <p className="mt-2 max-w-2xl text-sm text-cyan-100/90">
          Early implementation access is available upon request for selected projects and enterprise programs.
        </p>
        <div className="mt-5">
          <Link
            href="/contact"
            className="inline-flex rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-cyan-700"
          >
            Request Technical Brief
          </Link>
        </div>
      </section>
    </SiteShell>
  )
}
