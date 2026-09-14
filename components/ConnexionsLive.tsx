'use client'

import { useCallback, useEffect, useState } from "react"
import { BackLink } from "@/components/BackLink"

type PresenceRow = {
  id: string
  login: string
  role: string
  role_label: string
  label: string
  path: string | null
  last_seen: string
  online: boolean
  seen_ago: string
}

const POLL_MS = 8_000

function pathLabel(path: string | null): string {
  if (!path || path === "/") return "Accueil"
  if (path.startsWith("/planning")) return "Planning"
  if (path.startsWith("/crm")) return "CRM"
  if (path.startsWith("/rapporteur") || path.startsWith("/rapports")) return "Rapports"
  if (path.startsWith("/nouveau")) return "Nouvelle intervention"
  if (path.startsWith("/devis")) return "Devis"
  if (path.startsWith("/facture")) return "Facturation"
  if (path.startsWith("/clients")) return "Clients"
  if (path.startsWith("/connexions")) return "Connexions"
  return path
}

export function ConnexionsLive() {
  const [sessions, setSessions] = useState<PresenceRow[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/presence", { cache: "no-store" })
      const data = await res.json() as {
        error?: string
        sessions?: PresenceRow[]
        online_count?: number
      }
      if (!res.ok) throw new Error(data.error || "Chargement impossible")
      setSessions(data.sessions || [])
      setOnlineCount(data.online_count || 0)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const online = sessions.filter((s) => s.online)
  const recent = sessions.filter((s) => !s.online)

  return (
    <main className="min-h-dvh bg-[#0a1628] text-slate-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a1628]/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <BackLink href="/crm" label="CRM" className="text-white hover:bg-white/10" />
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-white/55 font-semibold shrink-0">
              Connexions
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-white/70 shrink-0">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
            {onlineCount} en ligne
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-3 sm:px-5 py-4 sm:py-5 space-y-4">
        {error ? (
          <p className="rounded-xl bg-red-500/15 border border-red-400/30 text-red-100 px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <h2 className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-semibold mb-3">
            En ligne maintenant
          </h2>
          {loading && sessions.length === 0 ? (
            <p className="text-sm text-white/50">Chargement…</p>
          ) : online.length === 0 ? (
            <p className="text-sm text-white/50">Personne n’est connecté pour le moment.</p>
          ) : (
            <ul className="space-y-2">
              {online.map((s) => (
                <PresenceCard key={s.id} row={s} />
              ))}
            </ul>
          )}
        </section>

        {recent.length > 0 ? (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
            <h2 className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-semibold mb-3">
              Vu récemment
            </h2>
            <ul className="space-y-2">
              {recent.map((s) => (
                <PresenceCard key={s.id} row={s} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  )
}

function PresenceCard({ row }: { row: PresenceRow }) {
  return (
    <li className="rounded-xl bg-white text-slate-800 px-4 py-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full shrink-0 ${
              row.online ? "bg-emerald-500" : "bg-slate-300"
            }`}
            aria-hidden
          />
          <span className="font-bold text-[#0e2a52] truncate">{row.label}</span>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">
          {pathLabel(row.path)}
          <span className="text-slate-400"> · {row.seen_ago}</span>
        </p>
      </div>
      <span className="shrink-0 text-[10px] uppercase tracking-wide font-semibold text-slate-400 pt-0.5">
        {row.role_label}
      </span>
    </li>
  )
}
