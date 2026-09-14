'use client'

import { useState } from "react"
import VilleCombobox from "@/components/VilleCombobox"
import { SiretLookup } from "@/components/SiretLookup"
import { TextoPasteFill } from "@/components/TextoPasteFill"

export type SousTraitantLite = {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  notes?: string | null
}

export function CreationSousTraitant({
  sts,
  onCreated,
}: {
  sts: SousTraitantLite[]
  onCreated: (st: SousTraitantLite) => void
}) {
  const [nom, setNom] = useState("")
  const [email, setEmail] = useState("")
  const [tel, setTel] = useState("")
  const [adresse, setAdresse] = useState("")
  const [cp, setCp] = useState("")
  const [ville, setVille] = useState("")
  const [siret, setSiret] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")

  function reset() {
    setNom("")
    setEmail("")
    setTel("")
    setAdresse("")
    setCp("")
    setVille("")
    setSiret("")
    setNotes("")
  }

  async function handleSubmit() {
    if (!nom.trim()) {
      setError("Nom du sous-traitant requis")
      return
    }
    setSubmitting(true)
    setError("")
    setOk("")
    try {
      const res = await fetch("/api/sous-traitants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom,
          email: email || null,
          telephone: tel || null,
          siret,
          adresse,
          code_postal: cp,
          ville,
          notes,
        }),
      })
      const data = await res.json() as { error?: string; sous_traitant?: SousTraitantLite }
      if (!res.ok || !data.sous_traitant) throw new Error(data.error || "Création impossible")
      onCreated(data.sous_traitant)
      reset()
      setOk(`${data.sous_traitant.nom} est enregistré.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white text-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
        <div>
          <h2 className="font-black text-[#0e2a52]">Nouveau sous-traitant</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Colle un texto ou un SIRET : raison sociale et adresse se remplissent tout seuls.
          </p>
        </div>

        {error ? <p className="text-sm text-red-600 font-semibold">{error}</p> : null}
        {ok ? <p className="text-sm text-emerald-700 font-semibold">{ok}</p> : null}

        <TextoPasteFill
          onFill={(d) => {
            if (d.client_nom) setNom(d.client_nom)
            if (d.client_email) setEmail(d.client_email)
            if (d.client_telephone) setTel(d.client_telephone)
            if (d.adresse) setAdresse(d.adresse)
            if (d.code_postal) setCp(d.code_postal)
            if (d.ville) setVille(d.ville)
            if (d.notes) setNotes(d.notes)
          }}
        />
        <SiretLookup
          onFound={(c) => {
            setNom(c.nom)
            setAdresse(c.adresse)
            setCp(c.code_postal)
            setVille(c.ville)
            setSiret(c.siret)
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm sm:col-span-2">
            <span className="text-xs uppercase text-slate-500">Raison sociale</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className="mt-1 w-full border-2 rounded-lg px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="text-xs uppercase text-slate-500">Téléphone</span>
            <input value={tel} onChange={(e) => setTel(e.target.value)} className="mt-1 w-full border-2 rounded-lg px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="text-xs uppercase text-slate-500">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border-2 rounded-lg px-3 py-2" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-xs uppercase text-slate-500">Adresse</span>
            <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="mt-1 w-full border-2 rounded-lg px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="text-xs uppercase text-slate-500">Ville</span>
            <div className="mt-1">
              <VilleCombobox
                value={ville}
                onChange={setVille}
                onSelect={(v) => { setVille(v.nom); setCp(v.cp) }}
              />
            </div>
          </label>
          <label className="text-sm">
            <span className="text-xs uppercase text-slate-500">Code postal</span>
            <div className="mt-1">
              <VilleCombobox
                value={cp}
                onChange={setCp}
                onSelect={(v) => { setVille(v.nom); setCp(v.cp) }}
                placeholder="Code postal — toute la France"
              />
            </div>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-xs uppercase text-slate-500">Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full border-2 rounded-lg px-3 py-2" />
          </label>
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleSubmit()}
          className="w-full rounded-xl bg-[#0e2a52] text-white font-bold py-3 disabled:opacity-50"
        >
          {submitting ? "Enregistrement…" : "Enregistrer le sous-traitant"}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-xs uppercase tracking-[0.16em] text-white/50 font-semibold mb-3">
          Sous-traitants ({sts.length})
        </h3>
        {sts.length === 0 ? (
          <p className="text-sm text-white/50">Aucun sous-traitant pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {sts.map((s) => (
              <li key={s.id} className="rounded-xl bg-white text-slate-800 px-4 py-3">
                <div className="font-bold text-[#0e2a52]">{s.nom}</div>
                <p className="text-sm text-slate-500">
                  {[s.telephone, s.email].filter(Boolean).join(" · ") || "Pas de contact"}
                </p>
                {s.notes ? (
                  <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">{s.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
