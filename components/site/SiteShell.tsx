"use client"

import Link from "next/link"
import { ReactNode, useState } from "react"

type SiteShellProps = {
  title: string
  subtitle: string
  children: ReactNode
}

const navItems = [
  { href: "/", label: "Home" },
  { href: "/system", label: "System" },
  { href: "/pulse-platform", label: "Pulse" },
  { href: "/insights", label: "Insights" },
  { href: "/enterprise", label: "Enterprise" },
  { href: "/contact", label: "Contact" },
]

export default function SiteShell({ title, subtitle, children }: SiteShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_500px_at_20%_-5%,#0f2742_0%,#09121d_45%,#05080e_100%)] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-heading text-lg tracking-wide text-slate-100">
            FRACTALBUILD
          </Link>

          <button
            type="button"
            className="inline-flex h-10 w-10 flex-col items-center justify-center gap-1 rounded-md border border-slate-700 text-slate-200 md:hidden"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-controls="site-mobile-menu"
          >
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
            <span className="sr-only">Toggle menu</span>
          </button>

          <nav className="hidden items-center gap-4 md:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-slate-300 hover:text-cyan-300">
                {item.label}
              </Link>
            ))}
            <Link
              href="/projects?flow=load"
              className="rounded-lg border border-cyan-500/60 px-3 py-1.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/10"
            >
              Open Pulse
            </Link>
          </nav>
        </div>

        {menuOpen ? (
          <div id="site-mobile-menu" className="border-t border-slate-800 bg-slate-950/95 px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-2 py-2 text-sm text-slate-200 hover:bg-slate-900"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/projects?flow=load"
                className="mt-2 rounded-md border border-cyan-500/70 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/10"
                onClick={() => setMenuOpen(false)}
              >
                Open Pulse
              </Link>
            </nav>
          </div>
        ) : null}
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/90">FractalBuild Infrastructure</p>
        <h1 className="mt-3 font-heading text-3xl leading-tight text-slate-100 md:text-5xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-base text-slate-300 md:text-lg">{subtitle}</p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-14">{children}</section>

      <footer className="border-t border-slate-800 bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>FractalBuild · Structured Intelligence Infrastructure for Sports Construction</p>
          <p>Early implementation access available upon request.</p>
        </div>
      </footer>
    </main>
  )
}
