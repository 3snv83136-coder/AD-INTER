'use client'

import { useState } from "react"
import SignatureCanvas from "@/components/accord/SignatureCanvas"
import { BRAND_NAME } from "@/lib/brand"
import { fmtDateFR } from "@/lib/format"
import {
  CGU_SOUS_TRAITANCE_CASE,
  CGU_SOUS_TRAITANCE_PARAGRAPHES,
  CGU_SOUS_TRAITANCE_TITRE,
} from "@/lib/sous-traitance-cgu"

type Teaser = {
  type_intervention: string | null
  date_prevue: string | null
  heure_prevue: string | null
  ville: string | null
  sous_traitant_nom: string
}

export function AcceptationSousTraitance({
  token,
  preview,
  teaser,
  onAccepted,
}: {
  token: string
  preview: boolean
  teaser: Teaser
  onAccepted: () => void
}) {
  const [cgu, setCgu] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const canSubmit = cgu && Boolean(signature) && !busy

  async function submit() {
    if (!canSubmit || !signature) return
    setBusy(true)
    setError("")
    if (preview) {
      onAccepted()
      setBusy(false)
      return
    }
    try {
      const res = await fetch(`/api/apport/${encodeURIComponent(token)}/accepter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cgu: true, signature }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error || "Acceptation impossible")
      onAccepted()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Acceptation impossible")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white text-slate-800 p-5 space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Mission proposée</p>
        <p className="font-black text-[#0e2a52]">{teaser.type_intervention || "Intervention"}</p>
        <p className="text-sm text-slate-600">
          {[fmtDateFR(teaser.date_prevue), teaser.heure_prevue, teaser.ville].filter(Boolean).join(" · ")}
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Les coordonnées du client s’affichent après signature.
        </p>
      </section>

      <section className="rounded-2xl bg-white text-slate-800 p-5 space-y-3">
        <h2 className="font-black text-[#0e2a52]">{CGU_SOUS_TRAITANCE_TITRE}</h2>
        <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          {CGU_SOUS_TRAITANCE_PARAGRAPHES.map((p) => (
            <p key={p.slice(0, 40)} className="text-xs text-slate-600 leading-relaxed">{p}</p>
          ))}
        </div>
        <label className="flex items-start gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={cgu}
            onChange={(e) => setCgu(e.target.checked)}
            className="mt-1 h-5 w-5 accent-amber-500"
          />
          <span>{CGU_SOUS_TRAITANCE_CASE}</span>
        </label>
      </section>

      <section className="rounded-2xl bg-white text-slate-800 p-5">
        <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">
          Signature électronique
        </p>
        <SignatureCanvas onChange={setSignature} hint="Signe dans le cadre pour prendre l’intervention" />
      </section>

      {error ? (
        <p className="rounded-xl bg-red-500/15 border border-red-400/30 text-red-100 px-4 py-3 text-sm">{error}</p>
      ) : null}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void submit()}
        className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0a1628] font-black py-4 text-lg disabled:opacity-40"
      >
        {busy ? "Enregistrement…" : `Prendre en charge — ${BRAND_NAME}`}
      </button>
    </div>
  )
}
