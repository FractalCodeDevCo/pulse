import Link from "next/link"

import BlueprintSection from "../components/site/BlueprintSection"
import SiteShell from "../components/site/SiteShell"

export default function HomePage() {
  return (
    <SiteShell
      title="The operational edge your competitors still do not have."
      subtitle="Turn field execution into traceable data, expose hidden margin leakage, and optimize every project phase."
    >
      <section className="flex flex-wrap gap-3">
        <Link
          href="/projects?flow=load"
          className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-cyan-700"
        >
          See Field Workflow
        </Link>
        <Link
          href="/contact"
          className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-900"
        >
          Request Technical Brief
        </Link>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 md:p-7">
        <h2 className="font-heading text-2xl text-slate-100 md:text-3xl">While others still operate blind:</h2>
        <ul className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">No real consumption measurement.</li>
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">No performance comparison by phase or crew.</li>
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">No pattern detection before problems scale.</li>
          <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">No visibility on where money is leaking.</li>
        </ul>
      </section>

      <BlueprintSection />

      <section className="mt-10">
        <h2 className="font-heading text-2xl text-slate-100 md:text-3xl">How It Works</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h3 className="font-heading text-lg text-cyan-100">Capture by zone.</h3>
            <p className="mt-2 text-sm text-slate-300">Each field is structured into a repeatable operational map.</p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h3 className="font-heading text-lg text-cyan-100">Organize by phase.</h3>
            <p className="mt-2 text-sm text-slate-300">Execution evidence stays linked to process checkpoints and crews.</p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h3 className="font-heading text-lg text-cyan-100">Decide with data.</h3>
            <p className="mt-2 text-sm text-slate-300">Spot deviations earlier and protect margin before rework escalates.</p>
          </article>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-2xl text-slate-100 md:text-3xl">Operational Value</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-200">Less rework.</article>
          <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-200">More control of project margin.</article>
          <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-200">Higher crew performance visibility.</article>
          <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-200">Your own historical operational dataset.</article>
        </div>
      </section>

      <section className="mt-10 rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-6 md:p-7">
        <h2 className="font-heading text-2xl text-cyan-100 md:text-3xl">Activate the Blueprint in Your Next Project</h2>
        <p className="mt-2 max-w-2xl text-sm text-cyan-100/90">Start with live zone capture in the field and build your own decision-grade operational baseline.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/projects?flow=load"
            className="inline-flex rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-cyan-700"
          >
            See Field Workflow
          </Link>
          <Link
            href="/contact"
            className="inline-flex rounded-lg border border-cyan-300/60 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/10"
          >
            Request Technical Brief
          </Link>
        </div>
      </section>
    </SiteShell>
  )
}
