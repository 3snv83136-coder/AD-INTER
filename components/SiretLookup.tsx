'use client'

import { useState } from "react"

type SiretFound = {
  nom: string
  adresse: string
  code_postal: string
  ville: string
  siret: string
}

export function SiretLookup({ onFound }: { onFound: (c: SiretFound) => void }) {
  const [siret, setSiret] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState<{ nom: string; activite: string | null } | null>(null)

  async function lookup(value: string) {
    const cleaned = value.replace(/[\s.-]/g, "")
    if (!/^\d{14}$/.test(cleaned)) return
    setLoading(true)
    setError("")
    setInfo(null)
    try {
      const res = await fetch(`/api/siret/${cleaned}`, { cache: "no-store" })
      const data = await res.json() as {
        error?: string
        nom?: string
        activite?: string | null
        adresse?: string
        code_postal?: string
        ville?: string
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setInfo({ nom: data.nom || "", activite: data.activite ?? null })
      onFound({
        nom: data.nom || "",
        adresse: data.adresse || "",
        code_postal: data.code_postal || "",
        ville: data.ville || "",
        siret: cleaned,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lookup SIRET")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3">
      <label className="block text-sm">
        <span className="text-xs uppercase tracking-wide text-blue-900 font-bold">
          Recherche par SIRET (entreprise)
        </span>
        <div className="flex gap-2 mt-1.5">
          <input
            inputMode="numeric"
            value={siret}
            onChange={(e) => {
              const v = e.target.value
              setSiret(v)
              setError("")
              const cleaned = v.replace(/[\s.-]/g, "")
              if (/^\d{14}$/.test(cleaned)) void lookup(cleaned)
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text").replace(/[\s.-]/g, "")
              if (/^\d{14}$/.test(pasted)) {
                e.preventDefault()
                setSiret(pasted)
                void lookup(pasted)
              }
            }}
            placeholder="14 chiffres — coller un SIRET"
            maxLength={20}
            className="flex-1 border-2 border-blue-300 focus:border-blue-600 outline-none rounded-lg px-3 py-2 text-sm font-mono bg-white"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => void lookup(siret)}
            disabled={loading || !/^\d{14}$/.test(siret.replace(/[\s.-]/g, ""))}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {loading ? "…" : "Trouver"}
          </button>
        </div>
      </label>
      {info ? (
        <div className="mt-2 p-2 bg-emerald-50 border border-emerald-300 rounded-lg text-xs">
          <div className="font-bold text-emerald-900">✓ {info.nom}</div>
          {info.activite ? <div className="text-emerald-700 mt-0.5">{info.activite}</div> : null}
          <div className="text-emerald-700 mt-0.5 italic">Coordonnées remplies automatiquement ci-dessous.</div>
        </div>
      ) : null}
      {error ? <div className="mt-2 text-xs text-red-700 font-semibold">⚠ {error}</div> : null}
    </div>
  )
}
