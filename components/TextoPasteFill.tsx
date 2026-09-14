'use client'

import { useState } from "react"
import { parseTextoLocal, type TextoFields } from "@/lib/parse-texto"

export function TextoPasteFill({
  onFill,
}: {
  onFill: (data: TextoFields) => void
}) {
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")

  async function remplir() {
    const raw = text.trim()
    if (raw.length < 10) {
      setError("Colle un texto un peu plus long (nom, tél, adresse…).")
      return
    }
    setLoading(true)
    setError("")
    setOk("")
    const local = parseTextoLocal(raw)
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcription: raw }),
      })
      const data = await res.json() as TextoFields & { warning?: string; error?: string }
      if (!res.ok && !data.client_nom && !data.adresse) {
        onFill(local)
        setOk("Champs remplis depuis le texto (mode rapide).")
        return
      }
      onFill({
        client_nom: data.client_nom || local.client_nom,
        client_email: data.client_email || local.client_email,
        client_telephone: data.client_telephone || local.client_telephone,
        adresse: data.adresse || local.adresse,
        ville: data.ville || local.ville,
        code_postal: data.code_postal || local.code_postal,
        type_intervention: data.type_intervention || local.type_intervention,
        date_intervention: data.date_intervention || local.date_intervention,
        heure: data.heure || local.heure,
        notes: data.notes || local.notes,
      })
      setOk(data.warning ? `${data.warning}` : "Champs remplis depuis le texto.")
    } catch {
      onFill(local)
      setOk("Champs remplis depuis le texto (mode rapide).")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 space-y-2">
      <span className="text-xs uppercase tracking-wide text-amber-900 font-bold">
        Coller un texto
      </span>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setError(""); setOk("") }}
        rows={4}
        placeholder={"Ex. : Mme Dupont 06 12 34 56 78\n12 rue de la Paix 83000 Toulon\nWC bouché demain 9h"}
        className="w-full border-2 border-amber-300 focus:border-amber-600 outline-none rounded-lg px-3 py-2 text-sm bg-white"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-amber-900/70">
          Colle le SMS du client : nom, téléphone, adresse et type se remplissent tout seuls.
        </p>
        <button
          type="button"
          onClick={() => void remplir()}
          disabled={loading}
          className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
        >
          {loading ? "Analyse…" : "Remplir"}
        </button>
      </div>
      {error ? <p className="text-xs text-red-700 font-semibold">{error}</p> : null}
      {ok ? <p className="text-xs text-emerald-800 font-semibold">{ok}</p> : null}
    </div>
  )
}
