"use client"

import {
  DETAILS_TRAVAUX,
  ETAGES_RAPIDES,
  PAIEMENTS_INTERVENTION,
  type ConsignesIntervention,
} from "@/lib/consignes-intervention"

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((v) => v !== item) : [...list, item]
}

export function ConsignesInterventionFields({
  value,
  onChange,
  accent = "amber",
}: {
  value: ConsignesIntervention
  onChange: (next: ConsignesIntervention) => void
  accent?: "amber" | "blue"
}) {
  const selected =
    accent === "blue"
      ? "border-blue-500 bg-blue-50 text-[#0e2a52]"
      : "border-amber-500 bg-amber-50 text-[#0e2a52]"

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Paiement</p>
        <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PAIEMENTS_INTERVENTION.map((p) => (
            <label
              key={p}
              className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold cursor-pointer ${
                value.paiements.includes(p) ? selected : "border-slate-200 text-slate-700"
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-amber-500"
                checked={value.paiements.includes(p)}
                onChange={() => onChange({ ...value, paiements: toggle(value.paiements, p) })}
              />
              <span>{p}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Étage</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {ETAGES_RAPIDES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onChange({ ...value, etage: value.etage === e ? "" : e })}
              className={`min-w-[3rem] rounded-xl border-2 px-3 py-2 text-sm font-bold ${
                value.etage === e ? selected : "border-slate-200 text-slate-700"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        <input
          value={value.etage}
          onChange={(e) => onChange({ ...value, etage: e.target.value })}
          placeholder="Étage, bâtiment, appartement…"
          className="mt-2 w-full border-2 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Détail des travaux</p>
        <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DETAILS_TRAVAUX.map((d) => (
            <label
              key={d}
              className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold cursor-pointer ${
                value.details.includes(d) ? selected : "border-slate-200 text-slate-700"
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-amber-500"
                checked={value.details.includes(d)}
                onChange={() => onChange({ ...value, details: toggle(value.details, d) })}
              />
              <span>{d}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="text-sm block">
        <span className="text-xs uppercase text-slate-500 font-semibold">Autres consignes</span>
        <textarea
          value={value.extra}
          onChange={(e) => onChange({ ...value, extra: e.target.value })}
          rows={2}
          placeholder="Code, interphone, stationnement…"
          className="mt-1 w-full border-2 rounded-lg px-3 py-2"
        />
      </label>
    </div>
  )
}
