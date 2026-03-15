import SiteShell from "../../components/site/SiteShell"

export default function ContactPage() {
  return (
    <SiteShell
      title="Request Technical Briefing."
      subtitle="For early implementation access, operational pilot scope, and executive-level system review."
    >
      <section className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
        <p className="text-sm text-slate-300">
          Contact channel for FractalBuild technical briefing:
        </p>
        <p className="mt-3 font-heading text-xl text-cyan-200">contact@fractalbuild.com</p>
        <p className="mt-3 text-sm text-slate-400">
          Include project type, sport, and deployment timeline in your message.
        </p>
      </section>
    </SiteShell>
  )
}
