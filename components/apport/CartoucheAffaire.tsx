"use client"

import { fmtDateFR } from "@/lib/format"
import {
  consignesHasContent,
  parseConsignesIntervention,
} from "@/lib/consignes-intervention"

export type CartoucheAffaireData = {
  type_intervention: string | null
  date_prevue: string | null
  heure_prevue: string | null
  ville: string | null
  adresse: string
  client_nom: string | null
  client_telephone: string | null
  client_email: string | null
  notes: string | null
}

function telHref(raw: string): string {
  const compact = raw.replace(/[^\d+]/g, "")
  return compact ? `tel:${compact}` : ""
}

function mapsUrl(query: string): string {
  const q = encodeURIComponent(query)
  if (typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return `https://maps.apple.com/?daddr=${q}`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`
}

function wazeUrl(query: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`
}

export function NotesIntervention({ notes }: { notes: string | null | undefined }) {
  const c = parseConsignesIntervention(notes)
  if (!consignesHasContent(c)) return null
  return (
    <div className="space-y-2">
      {c.etage ? (
        <div className="rounded-xl bg-[#0e2a52] text-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-white/70 font-black">Étage</p>
          <p className="text-xl font-black leading-tight">{c.etage}</p>
        </div>
      ) : null}
      {c.paiements.length > 0 ? (
        <div className="rounded-xl bg-emerald-50 border-2 border-emerald-400 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-emerald-800 font-black">Paiement</p>
          <p className="mt-1 text-base font-black text-emerald-950">{c.paiements.join(" · ")}</p>
        </div>
      ) : null}
      {c.details.length > 0 ? (
        <div className="rounded-xl bg-slate-50 border-2 border-slate-200 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 font-black">Détail des travaux</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.details.map((d) => (
              <span
                key={d}
                className="inline-flex rounded-lg bg-[#0e2a52] text-white text-xs font-bold px-2.5 py-1"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {c.extra ? (
        <div className="rounded-xl bg-amber-50 border-2 border-amber-400 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-amber-800 font-black">Notes d’intervention</p>
          <p className="mt-1 text-base font-bold text-amber-950 whitespace-pre-line leading-snug">{c.extra}</p>
        </div>
      ) : null}
    </div>
  )
}

export function CartoucheAffaire({ affaire }: { affaire: CartoucheAffaireData }) {
  const tel = affaire.client_telephone?.trim() || ""
  const call = tel ? telHref(tel) : ""
  const lieu = [affaire.adresse, affaire.ville].filter(Boolean).join(" ").trim()
  const email = affaire.client_email?.trim() || ""

  return (
    <section className="rounded-2xl bg-white text-slate-800 p-5 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Travaux</p>
        <p className="font-black text-[#0e2a52] text-lg leading-tight">
          {affaire.type_intervention || "Intervention"}
        </p>
        <p className="text-sm text-slate-600 mt-0.5">
          {[fmtDateFR(affaire.date_prevue), affaire.heure_prevue].filter(Boolean).join(" · ")}
        </p>
      </div>

      {affaire.client_nom ? (
        <p className="text-3xl font-black text-slate-900 leading-tight">{affaire.client_nom}</p>
      ) : null}

      {affaire.ville ? (
        <p className="text-2xl font-black text-[#0e2a52] leading-tight">{affaire.ville}</p>
      ) : null}

      {affaire.adresse ? (
        <p className="text-sm text-slate-700 leading-snug">{affaire.adresse}</p>
      ) : null}

      {email ? (
        <a
          href={`mailto:${email}`}
          className="block text-sm font-semibold text-blue-700 break-all"
        >
          {email}
        </a>
      ) : null}

      {call ? (
        <a
          href={call}
          className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xl py-4 px-4 shadow-md"
        >
          <span aria-hidden>📞</span>
          <span>{tel}</span>
        </a>
      ) : null}

      {lieu ? (
        <div className="grid grid-cols-2 gap-2">
          <a
            href={mapsUrl(lieu)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-[#0e2a52] hover:bg-[#163a6e] text-white font-bold text-sm py-3 px-3"
          >
            Maps
          </a>
          <a
            href={wazeUrl(lieu)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-[#33ccff] hover:bg-[#1eb8ed] text-[#0a1628] font-bold text-sm py-3 px-3"
          >
            Waze
          </a>
        </div>
      ) : null}

      <NotesIntervention notes={affaire.notes} />
    </section>
  )
}
