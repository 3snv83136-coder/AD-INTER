"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"

type Prise = {
  id: string
  intervention_id: string
  sous_traitant_nom: string
  type_intervention: string | null
  ville: string | null
  reference: string | null
  signed_at: string
}

const POLL_MS = 8_000
const SEEN_KEY = "crm_sig_seen"
const DISMISS_KEY = "crm_sig_dismissed"

function readIds(key: string): string[] {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === "string")
  } catch {
    return []
  }
}

function writeIds(key: string, ids: string[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(ids.slice(0, 80)))
  } catch {
    /* quota / mode privé */
  }
}

function relativeFr(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return "à l’instant"
  const min = Math.floor(ms / 60_000)
  if (min < 1) return "à l’instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function beep(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = 880
    gain.gain.value = 0.07
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.16)
    window.setTimeout(() => void ctx.close(), 400)
  } catch {
    /* autoplay / WebAudio indisponible */
  }
}

function notifyDesktop(prise: Prise): void {
  if (typeof Notification === "undefined") return
  if (Notification.permission !== "granted") return
  try {
    const title = `${prise.sous_traitant_nom} a signé`
    const body = [prise.type_intervention, prise.ville].filter(Boolean).join(" · ") || "Prise en charge"
    new Notification(title, { body, tag: prise.id })
  } catch {
    /* notifications bloquées */
  }
}

export function CrmSignatureSignal({
  compact = false,
  tone = "light",
}: {
  compact?: boolean
  tone?: "dark" | "light"
}) {
  const [prises, setPrises] = useState<Prise[]>([])
  const [freshIds, setFreshIds] = useState<string[]>([])
  const seenRef = useRef<Set<string>>(new Set())
  const primedRef = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/prises-en-charge", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { prises?: Prise[] }
      const next = data.prises || []
      const dismissed = new Set(readIds(DISMISS_KEY))
      const visible = next.filter((p) => !dismissed.has(p.id))

      const seen = seenRef.current
      if (!primedRef.current) {
        primedRef.current = true
        readIds(SEEN_KEY).forEach((id) => seen.add(id))
        visible.forEach((p) => seen.add(p.id))
        writeIds(SEEN_KEY, Array.from(seen))
        setFreshIds([])
        setPrises(visible)
        return
      }

      const arriving = visible.filter((p) => !seen.has(p.id))
      if (arriving.length > 0) {
        arriving.forEach((p) => seen.add(p.id))
        writeIds(SEEN_KEY, Array.from(seen))
        setFreshIds((prev) => [...arriving.map((p) => p.id), ...prev].slice(0, 20))
        beep()
        notifyDesktop(arriving[0])
      }
      setPrises(visible)
    } catch {
      /* polling silencieux */
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") void load()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [load])

  const dismiss = (id: string) => {
    const next = [...readIds(DISMISS_KEY), id]
    writeIds(DISMISS_KEY, next)
    setPrises((prev) => prev.filter((p) => p.id !== id))
    setFreshIds((prev) => prev.filter((x) => x !== id))
  }

  if (prises.length === 0) return null

  const shown = compact ? prises.slice(0, 2) : prises.slice(0, 6)
  const extra = prises.length - shown.length
  const dark = tone === "dark"
  const hasFresh = shown.some((p) => freshIds.includes(p.id))

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl overflow-hidden ring-1 ${
        dark
          ? "bg-emerald-500/15 ring-emerald-400/40 text-white"
          : "bg-emerald-50 ring-emerald-200 text-emerald-950"
      } ${compact ? "mb-3" : ""}`}
    >
      <div className={`flex items-start justify-between gap-3 px-3 py-2.5 sm:px-4 ${compact ? "py-2" : "sm:py-3"}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0 ${hasFresh ? "animate-pulse" : ""}`}
              aria-hidden
            />
            <p className={`text-xs sm:text-sm font-extrabold ${dark ? "text-emerald-100" : "text-emerald-900"}`}>
              {prises.length === 1
                ? "Sous-traitant venu de signer"
                : `${prises.length} prises en charge signées`}
            </p>
          </div>
          <ul className="mt-1.5 space-y-1">
            {shown.map((p) => {
              const fresh = freshIds.includes(p.id)
              const meta = [p.type_intervention, p.ville, p.reference].filter(Boolean).join(" · ")
              return (
                <li key={p.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${dark ? "text-white" : "text-emerald-950"}`}>
                      {p.sous_traitant_nom}
                      {fresh ? (
                        <span className={`ml-2 text-[10px] uppercase tracking-wide font-black ${dark ? "text-amber-400" : "text-amber-600"}`}>
                          Nouveau
                        </span>
                      ) : null}
                    </p>
                    <p className={`text-[11px] sm:text-xs truncate ${dark ? "text-white/70" : "text-emerald-800/80"}`}>
                      {meta || "Intervention"} · {relativeFr(p.signed_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(p.id)}
                    className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${
                      dark
                        ? "text-white/60 hover:text-white hover:bg-white/10"
                        : "text-emerald-700/70 hover:text-emerald-900 hover:bg-emerald-100"
                    }`}
                    aria-label="Masquer le signal"
                  >
                    OK
                  </button>
                </li>
              )
            })}
          </ul>
          {extra > 0 ? (
            <p className={`mt-1 text-[11px] ${dark ? "text-white/55" : "text-emerald-800/70"}`}>
              et {extra} autre{extra > 1 ? "s" : ""}
            </p>
          ) : null}
        </div>
        <Link
          href="/rapporteur"
          className={`shrink-0 self-center rounded-xl px-3 py-2 text-xs sm:text-sm font-bold ${
            dark
              ? "bg-emerald-400 text-[#0a1628] hover:bg-emerald-300"
              : "bg-emerald-600 text-white hover:bg-emerald-500"
          }`}
        >
          Voir
        </Link>
      </div>
    </div>
  )
}
