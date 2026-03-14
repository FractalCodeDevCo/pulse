import SiteShell from "../../components/site/SiteShell"

export default function EnterprisePage() {
  return (
    <SiteShell
      title="Enterprise Implementation Layer."
      subtitle="Early implementation access for organizations that require structured operational control across sports construction programs."
    >
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg">Implementation Scope</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
            <li>Project and zone setup model</li>
            <li>Capture standardization by process step</li>
            <li>Operational baseline initialization</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg">Executive Deliverables</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
            <li>Deviation visibility by zone</li>
            <li>Risk trend snapshots</li>
            <li>Historical dataset export readiness</li>
          </ul>
        </article>
      </section>
    </SiteShell>
  )
}
