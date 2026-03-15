"use client"

import Link from "next/link"
import { FormEvent, useEffect, useMemo, useState } from "react"

import SiteShell from "../../../components/site/SiteShell"

type InsightStatus = "draft" | "published"

type Insight = {
  id: string
  slug: string
  title: string
  summary: string
  body: string
  status: InsightStatus
  created_at: string
  updated_at: string
}

type ApiResponse = {
  insights?: Insight[]
  insight?: Insight
  warning?: string
  error?: string
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

const EMPTY_FORM = {
  id: "",
  slug: "",
  title: "",
  summary: "",
  body: "",
  status: "draft" as InsightStatus,
}

export default function InsightsAdminPage() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [warning, setWarning] = useState("")

  useEffect(() => {
    let cancelled = false

    async function loadInsights() {
      setIsLoading(true)
      setError("")
      try {
        const response = await fetch("/api/insights?includeDraft=1", { cache: "no-store" })
        const data = (await response.json()) as ApiResponse
        if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar insights.")
        if (cancelled) return
        setInsights(data.insights ?? [])
        setWarning(data.warning ?? "")
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar insights.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadInsights()
    return () => {
      cancelled = true
    }
  }, [])

  const canSubmit = useMemo(() => {
    return form.title.trim().length > 0 && form.summary.trim().length > 0
  }, [form.summary, form.title])

  function editInsight(insight: Insight) {
    setForm({
      id: insight.id,
      slug: insight.slug,
      title: insight.title,
      summary: insight.summary,
      body: insight.body,
      status: insight.status,
    })
    setMessage("")
    setError("")
  }

  function resetForm() {
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")
    if (!canSubmit) {
      setError("Título y resumen son obligatorios.")
      return
    }

    setIsSaving(true)
    try {
      const slug = form.slug.trim() ? slugify(form.slug) : slugify(form.title)
      const method = form.id ? "PUT" : "POST"
      const payload = {
        id: form.id || undefined,
        slug,
        title: form.title.trim(),
        summary: form.summary.trim(),
        body: form.body.trim(),
        status: form.status,
      }

      const response = await fetch("/api/insights", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await response.json()) as ApiResponse
      if (!response.ok || !data.insight) throw new Error(data.error ?? "No se pudo guardar.")

      setInsights((current) => {
        const next = current.filter((item) => item.id !== data.insight!.id)
        next.unshift(data.insight!)
        return next
      })

      setMessage(form.id ? "Insight actualizado." : "Insight creado.")
      resetForm()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SiteShell
      title="Insights Admin."
      subtitle="Publica briefs técnicos sin tocar código. Mantén un repositorio vivo de insights operativos."
    >
      <section className="mb-4 flex items-center justify-between">
        <Link href="/insights" className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-900">
          Back to Insights
        </Link>
      </section>

      {warning ? (
        <section className="mb-4 rounded-2xl border border-amber-500/70 bg-amber-500/10 p-4 text-sm text-amber-200">
          {warning}
        </section>
      ) : null}
      {error ? (
        <section className="mb-4 rounded-2xl border border-red-500/70 bg-red-500/10 p-4 text-sm text-red-300">{error}</section>
      ) : null}
      {message ? (
        <section className="mb-4 rounded-2xl border border-emerald-500/70 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {message}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg text-slate-100">{form.id ? "Edit Insight" : "New Insight"}</h2>
          <label className="block space-y-1">
            <span className="text-sm text-slate-300">Title</span>
            <input
              type="text"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-slate-300">Slug (optional)</span>
            <input
              type="text"
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-slate-300">Summary</span>
            <textarea
              value={form.summary}
              onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-slate-300">Body (optional)</span>
            <textarea
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              rows={8}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-slate-300">Status</span>
            <select
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as InsightStatus }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!canSubmit || isSaving}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : form.id ? "Update Insight" : "Create Insight"}
            </button>
            {form.id ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-900"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>

        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="font-heading text-lg text-slate-100">Existing Insights</h2>
          {isLoading ? <p className="text-sm text-slate-400">Loading...</p> : null}
          {!isLoading && insights.length === 0 ? <p className="text-sm text-slate-400">No insights yet.</p> : null}
          <div className="space-y-2">
            {insights.map((insight) => (
              <article key={insight.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">{insight.title}</h3>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      insight.status === "published" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {insight.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-300">{insight.summary}</p>
                <button
                  type="button"
                  onClick={() => editInsight(insight)}
                  className="mt-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  Edit
                </button>
              </article>
            ))}
          </div>
        </section>
      </section>
    </SiteShell>
  )
}
