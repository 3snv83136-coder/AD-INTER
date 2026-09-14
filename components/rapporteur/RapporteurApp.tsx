'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BrandLogo } from "@/components/BrandLogo"
import ClientAutocomplete from "@/components/ClientAutocomplete"
import VilleCombobox from "@/components/VilleCombobox"
import { TYPES_INTERVENTION } from "@/lib/types-intervention"
import { fmtDateFR, fmtEUR } from "@/lib/format"
import { BRAND_NAME } from "@/lib/brand"
import type { Tarif } from "@/lib/types"

type Statut = "planifiee" | "en_cours" | "terminee" | "annulee"

type SousTraitant = {
  id: string
  nom: string
  email: string | null
  telephone: string | null
}

type Row = {
  id: string
  reference: string | null
  type_intervention: string | null
  adresse_chantier: string | null
  ville: string | null
  code_postal: string | null
  date_prevue: string | null
  heure_prevue: string | null
  urgence: boolean
  statut: Statut
  notes_internes: string | null
  client_nom: string | null
  client_email: string | null
  client_telephone: string | null
  sous_traitant_id: string | null
  sous_traitant_nom: string | null
  sous_traitant_email: string | null
  sous_traitant_telephone: string | null
  rapporteur_envoye_at: string | null
  rapporteur_facture_id: string | null
}

const STATUT_LABEL: Record<Statut, string> = {
  planifiee: "À envoyer",
  en_cours: "Chez le sous-traitant",
  terminee: "Terminée",
  annulee: "Annulée",
}

function fmtHeure(t: string | null): string {
  if (!t) return ""
  return t.slice(0, 5)
}

export default function RapporteurApp({ tarif }: { tarif: Tarif }) {
  const [rows, setRows] = useState<Row[]>([])
  const [sts, setSts] = useState<SousTraitant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<"all" | Statut>("all")
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState("")

  const load = useCallback(async () => {
    setError("")
    try {
      const [intRes, stRes] = await Promise.all([
        fetch("/api/interventions?flux=rapporteur&limit=300", { cache: "no-store" }),
        fetch("/api/sous-traitants", { cache: "no-store" }),
      ])
      const intData = await intRes.json()
      const stData = await stRes.json()
      if (!intRes.ok) throw new Error(intData.error || "Erreur interventions")
      if (!stRes.ok) throw new Error(stData.error || "Erreur sous-traitants")
      setRows(intData.interventions || [])
      setSts(stData.sous_traitants || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.statut === filter)),
    [rows, filter],
  )

  async function envoyer(id: string) {
    setBusyId(id)
    setError("")
    try {
      const res = await fetch(`/api/interventions/${id}/envoyer-sous-traitant`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Envoi impossible")
      if (typeof data.sms_uri === "string" && data.sms_uri) {
        window.location.href = data.sms_uri
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible")
    } finally {
      setBusyId("")
    }
  }

  async function cloturer(id: string) {
    if (!window.confirm(`Clôturer et éditer la facture « ${tarif.label} » (${fmtEUR(tarif.prix_min)} HT) ?`)) {
      return
    }
    setBusyId(id)
    setError("")
    try {
      const res = await fetch(`/api/interventions/${id}/cloturer-rapporteur`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Clôture impossible")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clôture impossible")
    } finally {
      setBusyId("")
    }
  }

  return (
    <div className="min-h-dvh bg-[#0a1628] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a1628]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" aria-label="Retour aux espaces">
              <BrandLogo variant="full" size={36} className="h-8 w-auto max-w-[160px]" />
            </Link>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400/90 font-bold">
                Allo Rapporteur d’affaires
              </div>
              <p className="text-xs text-white/55 truncate">
                {tarif.label} · {fmtEUR(tarif.prix_min)} HT
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="shrink-0 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0a1628] font-bold text-sm px-4 py-2"
          >
            + Nouvelle affaire
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(["all", "planifiee", "en_cours", "terminee"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                filter === k ? "bg-white text-[#0a1628]" : "bg-white/10 text-white/70 hover:bg-white/15"
              }`}
            >
              {k === "all" ? "Toutes" : STATUT_LABEL[k]}
            </button>
          ))}
        </div>

        {error ? (
          <div className="rounded-xl bg-red-500/15 border border-red-400/30 text-red-100 px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-white/50 text-center py-16">Chargement…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
            <p className="font-semibold">Aucune affaire pour ces filtres.</p>
            <p className="text-sm text-white/50 mt-1">Crée une intervention et envoie-la au sous-traitant.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((row) => (
              <li key={row.id} className="rounded-2xl bg-white text-slate-800 p-4 shadow-lg">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-black text-[#0e2a52]">
                      {row.client_nom || "Client"}
                      {row.urgence ? (
                        <span className="ml-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-md font-black">
                          URGENT
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-500">
                      {[row.type_intervention, row.ville, fmtDateFR(row.date_prevue), fmtHeure(row.heure_prevue)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="text-sm mt-1">
                      {[row.adresse_chantier, row.code_postal, row.ville].filter(Boolean).join(" ")}
                    </p>
                    {row.client_telephone ? (
                      <a className="text-sm text-blue-700 font-semibold" href={`tel:${row.client_telephone}`}>
                        {row.client_telephone}
                      </a>
                    ) : null}
                  </div>
                  <span className="text-xs font-bold rounded-full bg-slate-100 px-3 py-1">
                    {STATUT_LABEL[row.statut]}
                  </span>
                </div>
                <p className="text-sm mt-2 text-slate-600">
                  Sous-traitant : <strong>{row.sous_traitant_nom || "—"}</strong>
                  {row.rapporteur_envoye_at ? " · envoyé" : ""}
                  {row.rapporteur_facture_id ? " · facture éditée" : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.statut !== "terminee" && row.statut !== "annulee" ? (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void envoyer(row.id)}
                      className="rounded-lg bg-[#0e2a52] text-white text-sm font-bold px-3 py-2 disabled:opacity-50"
                    >
                      {row.rapporteur_envoye_at ? "Renvoyer au sous-traitant" : "Envoyer au sous-traitant"}
                    </button>
                  ) : null}
                  {row.statut !== "terminee" && row.statut !== "annulee" ? (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void cloturer(row.id)}
                      className="rounded-lg bg-emerald-600 text-white text-sm font-bold px-3 py-2 disabled:opacity-50"
                    >
                      Intervention finie — éditer la facture
                    </button>
                  ) : null}
                  {row.rapporteur_facture_id ? (
                    <Link
                      href="/facture"
                      className="rounded-lg bg-slate-100 text-slate-800 text-sm font-bold px-3 py-2"
                    >
                      Voir les factures
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {showForm ? (
        <NouvelleAffaireModal
          sts={sts}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            void load()
          }}
          onStCreated={(st) => setSts((prev) => [...prev, st].sort((a, b) => a.nom.localeCompare(b.nom)))}
        />
      ) : null}
    </div>
  )
}

function NouvelleAffaireModal({
  sts,
  onClose,
  onCreated,
  onStCreated,
}: {
  sts: SousTraitant[]
  onClose: () => void
  onCreated: () => void
  onStCreated: (st: SousTraitant) => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientNom, setClientNom] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [clientTel, setClientTel] = useState("")
  const [clientAdresse, setClientAdresse] = useState("")
  const [clientCP, setClientCP] = useState("")
  const [clientVille, setClientVille] = useState("")
  const [typeIntervention, setTypeIntervention] = useState<string>(TYPES_INTERVENTION[0])
  const [datePrevue, setDatePrevue] = useState(new Date().toISOString().slice(0, 10))
  const [heurePrevue, setHeurePrevue] = useState("09:00")
  const [urgence, setUrgence] = useState(false)
  const [notes, setNotes] = useState("")
  const [stId, setStId] = useState(sts[0]?.id || "")
  const [newStNom, setNewStNom] = useState("")
  const [newStEmail, setNewStEmail] = useState("")
  const [newStTel, setNewStTel] = useState("")

  async function addSousTraitant() {
    if (!newStNom.trim()) return
    setError("")
    try {
      const res = await fetch("/api/sous-traitants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: newStNom,
          email: newStEmail || null,
          telephone: newStTel || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Création impossible")
      const st = data.sous_traitant as SousTraitant
      onStCreated(st)
      setStId(st.id)
      setNewStNom("")
      setNewStEmail("")
      setNewStTel("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création sous-traitant impossible")
    }
  }

  async function handleSubmit() {
    if (!clientNom.trim()) { setError("Nom du client requis"); return }
    if (!stId) { setError("Choisis un sous-traitant"); return }
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/interventions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flux: "rapporteur",
          sous_traitant_id: stId,
          client: {
            id: clientId || undefined,
            nom: clientNom,
            email: clientEmail || null,
            telephone: clientTel || null,
            adresse: clientAdresse || null,
            code_postal: clientCP || null,
            ville: clientVille || null,
          },
          type_intervention: typeIntervention,
          adresse_chantier: clientAdresse || null,
          ville: clientVille || null,
          code_postal: clientCP || null,
          date_prevue: datePrevue || null,
          heure_prevue: heurePrevue || null,
          urgence,
          notes_internes: notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white text-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full my-8">
        <div className="border-b px-5 py-4 flex justify-between items-center">
          <h2 className="font-black text-[#0e2a52]">Nouvelle affaire — {BRAND_NAME}</h2>
          <button type="button" onClick={onClose} className="text-2xl text-slate-400 leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          {error ? <p className="text-sm text-red-600 font-semibold">{error}</p> : null}

          <ClientAutocomplete
            value={clientNom}
            onChange={(v) => { setClientNom(v); setClientId(null) }}
            onSelect={(c) => {
              setClientId(c.id)
              setClientNom(c.nom)
              setClientEmail(c.email || "")
              setClientTel(c.telephone || "")
              setClientAdresse(c.adresse || "")
              setClientCP(c.code_postal || "")
              setClientVille(c.ville || "")
            }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-xs uppercase text-slate-500">Téléphone</span>
              <input value={clientTel} onChange={(e) => setClientTel(e.target.value)} className="mt-1 w-full border-2 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase text-slate-500">Email</span>
              <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="mt-1 w-full border-2 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-xs uppercase text-slate-500">Adresse</span>
              <input value={clientAdresse} onChange={(e) => setClientAdresse(e.target.value)} className="mt-1 w-full border-2 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase text-slate-500">Ville</span>
              <div className="mt-1">
                <VilleCombobox
                  value={clientVille}
                  onChange={setClientVille}
                  onSelect={(v) => { setClientVille(v.nom); setClientCP(v.cp) }}
                />
              </div>
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase text-slate-500">Code postal</span>
              <input value={clientCP} onChange={(e) => setClientCP(e.target.value)} className="mt-1 w-full border-2 rounded-lg px-3 py-2" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {TYPES_INTERVENTION.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeIntervention(t)}
                className={`p-2.5 rounded-xl border-2 text-left text-sm font-semibold ${
                  typeIntervention === t ? "border-amber-500 bg-amber-50" : "border-slate-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-xs uppercase text-slate-500">Date</span>
              <input type="date" value={datePrevue} onChange={(e) => setDatePrevue(e.target.value)} className="mt-1 w-full border-2 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase text-slate-500">Heure</span>
              <input type="time" value={heurePrevue} onChange={(e) => setHeurePrevue(e.target.value)} className="mt-1 w-full border-2 rounded-lg px-3 py-2" />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={urgence} onChange={(e) => setUrgence(e.target.checked)} />
            Urgent
          </label>

          <label className="text-sm block">
            <span className="text-xs uppercase text-slate-500">Notes internes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full border-2 rounded-lg px-3 py-2" />
          </label>

          <div>
            <span className="text-xs uppercase text-slate-500 font-bold">Sous-traitant</span>
            <select
              value={stId}
              onChange={(e) => setStId(e.target.value)}
              className="mt-1 w-full border-2 rounded-lg px-3 py-2"
            >
              <option value="">Choisir…</option>
              {sts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}{s.telephone ? ` · ${s.telephone}` : ""}
                </option>
              ))}
            </select>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input placeholder="Nouveau nom" value={newStNom} onChange={(e) => setNewStNom(e.target.value)} className="border-2 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Email" value={newStEmail} onChange={(e) => setNewStEmail(e.target.value)} className="border-2 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Téléphone" value={newStTel} onChange={(e) => setNewStTel(e.target.value)} className="border-2 rounded-lg px-3 py-2 text-sm" />
            </div>
            <button type="button" onClick={() => void addSousTraitant()} className="mt-2 text-sm font-bold text-amber-700">
              + Enregistrer ce sous-traitant
            </button>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="w-full rounded-xl bg-[#0e2a52] text-white font-bold py-3 disabled:opacity-50"
          >
            {submitting ? "Création…" : "Créer l’affaire"}
          </button>
        </div>
      </div>
    </div>
  )
}
