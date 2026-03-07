import SiteShell from "../../components/site/SiteShell"

export default function SystemPage() {
  return (
    <SiteShell
      title="Structured Operational Intelligence System."
      subtitle="Fractal Core standardizes capture, normalizes variance, and protects project margin through technical control."
    >
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg">Operational Normalization</h2>
          <p className="mt-2 text-sm text-slate-300">
            Common zone vocabulary and repeatable process checkpoints across baseball, softball, football, and soccer.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg">Deviation Modeling</h2>
          <p className="mt-2 text-sm text-slate-300">
            Adhesive consumption ratio and process risk signals are computed at capture time for immediate action.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg">Traceable Evidence Layer</h2>
          <p className="mt-2 text-sm text-slate-300">
            Every record is bound to project, zone, timestamp, and photographic evidence stored in cloud infrastructure.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg">Financial Projection Readiness</h2>
          <p className="mt-2 text-sm text-slate-300">
            Dataset design is stable for downstream forecasting and historical benchmarking in Python/R workflows.
          </p>
        </article>
      </section>
    </SiteShell>
  )
}
