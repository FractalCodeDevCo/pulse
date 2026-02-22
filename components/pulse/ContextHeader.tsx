import Link from "next/link"

type HeaderCrumb = {
  label: string
  href?: string
}

type ContextHeaderProps = {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  breadcrumbs?: HeaderCrumb[]
  projectLabel?: string | null
  zoneLabel?: string | null
  statusLabel?: string | null
  dateLabel?: string | null
}

function HeaderMetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-300">
      {label}: {value}
    </span>
  )
}

export default function ContextHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Volver",
  breadcrumbs = [],
  projectLabel,
  zoneLabel,
  statusLabel,
  dateLabel,
}: ContextHeaderProps) {
  return (
    <header className="sticky top-0 z-40 -mx-4 border-b border-neutral-800 bg-neutral-950/95 px-4 pb-4 pt-3 backdrop-blur">
      <div className="mx-auto w-full max-w-5xl space-y-3">
        <div className="flex items-center gap-2">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex items-center rounded-lg border border-neutral-700 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-neutral-900"
            >
              ← {backLabel}
            </Link>
          ) : null}
        </div>

        {breadcrumbs.length > 0 ? (
          <nav className="flex flex-wrap items-center gap-1 text-xs text-neutral-400">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
                {crumb.href ? (
                  <Link href={crumb.href} className="rounded px-1 py-0.5 hover:bg-neutral-800 hover:text-neutral-200">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="rounded px-1 py-0.5 text-neutral-300">{crumb.label}</span>
                )}
                {index < breadcrumbs.length - 1 ? <span className="text-neutral-600">/</span> : null}
              </span>
            ))}
          </nav>
        ) : null}

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle ? <p className="text-sm text-neutral-400">{subtitle}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {projectLabel ? <HeaderMetaChip label="Proyecto" value={projectLabel} /> : null}
          {zoneLabel ? <HeaderMetaChip label="Zona" value={zoneLabel} /> : null}
          {statusLabel ? <HeaderMetaChip label="Estado" value={statusLabel} /> : null}
          {dateLabel ? <HeaderMetaChip label="Fecha" value={dateLabel} /> : null}
        </div>
      </div>
    </header>
  )
}
