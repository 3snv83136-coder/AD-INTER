'use client'

import { useCallback, useEffect, useState } from "react"
import { AcceptationSousTraitance } from "@/components/apport/AcceptationSousTraitance"
import { CartoucheAffaire } from "@/components/apport/CartoucheAffaire"
import { BRAND_NAME } from "@/lib/brand"

type Affaire = {
  type_intervention: string | null
  date_prevue: string | null
  heure_prevue: string | null
  ville: string | null
  adresse: string
  client_nom: string | null
  client_telephone: string | null
  client_email: string | null
  notes: string | null
  sous_traitant_nom: string
  already: boolean
  photo_avant: string | null
  photo_apres: string | null
}

type Slot = "avant" | "apres"

const APERCU_AFFAIRE: Affaire = {
  type_intervention: "Débouchage canalisation",
  date_prevue: new Date().toISOString().slice(0, 10),
  heure_prevue: "14:30",
  ville: "Pantin",
  adresse: "24 Rue Méhul 93500 PANTIN",
  client_nom: "M. Dupont",
  client_telephone: null,
  client_email: "client@exemple.fr",
  notes: "Exemple d’affaire — aperçu de la fiche reçue par l’apporteur.",
  sous_traitant_nom: "Sous-traitant",
  already: false,
  photo_avant: null,
  photo_apres: null,
}

export function ApportForm({ token, preview = false }: { token: string; preview?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [affaire, setAffaire] = useState<Affaire | null>(null)
  const [already, setAlready] = useState(false)
  const [sent, setSent] = useState(false)
  const [rapport, setRapport] = useState("")
  const [montant, setMontant] = useState("")
  const [avantUrl, setAvantUrl] = useState<string | null>(null)
  const [apresUrl, setApresUrl] = useState<string | null>(null)
  const [avantLocal, setAvantLocal] = useState<string | null>(null)
  const [apresLocal, setApresLocal] = useState<string | null>(null)
  const [uploading, setUploading] = useState<Slot | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [needsAcceptation, setNeedsAcceptation] = useState(true)

  const load = useCallback(async () => {
    if (preview) {
      setAffaire(APERCU_AFFAIRE)
      setAlready(false)
      setNeedsAcceptation(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/apport/${encodeURIComponent(token)}`, { cache: "no-store" })
      const data = await res.json() as {
        error?: string
        already?: boolean
        affaire?: Affaire
        needs_acceptation?: boolean
      }
      if (!res.ok || !data.affaire) throw new Error(data.error || "Lien invalide")
      setAffaire(data.affaire)
      setAlready(Boolean(data.already || data.affaire.already))
      setNeedsAcceptation(Boolean(data.needs_acceptation))
      setAvantUrl(data.affaire.photo_avant)
      setApresUrl(data.affaire.photo_apres)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lien invalide")
    } finally {
      setLoading(false)
    }
  }, [token, preview])

  useEffect(() => {
    void load()
  }, [load])

  async function uploadSlot(slot: Slot, file: File) {
    setUploading(slot)
    setError("")
    const local = URL.createObjectURL(file)
    if (slot === "avant") setAvantLocal(local)
    else setApresLocal(local)
    if (preview) {
      if (slot === "avant") setAvantUrl(local)
      else setApresUrl(local)
      setUploading(null)
      return
    }
    try {
      const body = new FormData()
      body.append("slot", slot)
      body.append("photo", file)
      const res = await fetch(`/api/apport/${encodeURIComponent(token)}/photo`, {
        method: "POST",
        body,
      })
      const data = await res.json() as { error?: string; url?: string }
      if (!res.ok || !data.url) throw new Error(data.error || "Upload impossible")
      if (slot === "avant") setAvantUrl(data.url)
      else setApresUrl(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload impossible")
      if (slot === "avant") {
        setAvantLocal(null)
        setAvantUrl(null)
      } else {
        setApresLocal(null)
        setApresUrl(null)
      }
    } finally {
      setUploading(null)
    }
  }

  async function handleSubmit() {
    if (!avantUrl || !apresUrl || !rapport.trim() || !montant.trim()) return
    setSubmitting(true)
    setError("")
    if (preview) {
      setSent(true)
      setSubmitting(false)
      return
    }
    try {
      const res = await fetch(`/api/apport/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rapport, montant }),
      })
      const data = await res.json() as { error?: string; already?: boolean }
      if (res.status === 409 || data.already) {
        setAlready(true)
        setSent(true)
        return
      }
      if (!res.ok) throw new Error(data.error || "Envoi impossible")
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible")
    } finally {
      setSubmitting(false)
    }
  }

  const canSend = Boolean(avantUrl && apresUrl && rapport.trim().length >= 8 && montant.trim() && !uploading && !submitting)

  return (
    <main className="min-h-dvh bg-[#0a1628] text-slate-100 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="border-b border-white/10 px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-semibold">{BRAND_NAME}</p>
        <h1 className="text-xl font-black mt-1">Rapport d’intervention</h1>
        {preview ? (
          <p className="text-xs font-semibold text-amber-200/90 mt-1">Aperçu — fiche telle que l’apporteur la reçoit</p>
        ) : null}
      </header>

      <div className="max-w-md mx-auto px-4 py-5 space-y-4">
        {loading ? <p className="text-white/60">Chargement…</p> : null}
        {error ? (
          <p className="rounded-xl bg-red-500/15 border border-red-400/30 text-red-100 px-4 py-3 text-sm">{error}</p>
        ) : null}

        {affaire && needsAcceptation && !sent && !already ? (
          <AcceptationSousTraitance
            token={token}
            preview={preview}
            teaser={affaire}
            onAccepted={() => {
              if (preview) {
                setNeedsAcceptation(false)
                return
              }
              void load()
            }}
          />
        ) : null}

        {sent || already ? (
          <section className="rounded-2xl bg-white text-slate-800 p-5 space-y-2">
            <h2 className="font-black text-[#0e2a52]">Dossier transmis</h2>
            <p className="text-sm text-slate-600">
              {sent
                ? `Merci. ${BRAND_NAME} a bien reçu les photos, le rapport et le montant. La facture de commission est éditée.`
                : "Ce dossier a déjà été envoyé. Merci."}
            </p>
          </section>
        ) : null}

        {affaire && !sent && !needsAcceptation ? (
          <>
            <CartoucheAffaire affaire={affaire} />

            {!already ? (
              <>
                <PhotoSlot
                  label="Photo avant"
                  preview={avantLocal || avantUrl}
                  busy={uploading === "avant"}
                  onFile={(f) => void uploadSlot("avant", f)}
                />
                <PhotoSlot
                  label="Photo après"
                  preview={apresLocal || apresUrl}
                  busy={uploading === "apres"}
                  onFile={(f) => void uploadSlot("apres", f)}
                />

                <label className="block rounded-2xl bg-white text-slate-800 p-5">
                  <span className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Rapport court</span>
                  <textarea
                    value={rapport}
                    onChange={(e) => setRapport(e.target.value)}
                    rows={5}
                    className="mt-2 w-full border-2 rounded-lg px-3 py-2 text-sm"
                    placeholder="Travaux réalisés, constat, matériel…"
                  />
                </label>

                <label className="block rounded-2xl bg-white text-slate-800 p-5">
                  <span className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Montant de l’intervention (€)</span>
                  <input
                    inputMode="decimal"
                    value={montant}
                    onChange={(e) => setMontant(e.target.value)}
                    className="mt-2 w-full border-2 rounded-lg px-3 py-2 text-lg font-bold"
                    placeholder="0,00"
                  />
                </label>

                <button
                  type="button"
                  disabled={!canSend}
                  onClick={() => void handleSubmit()}
                  className="w-full rounded-xl bg-emerald-600 text-white font-black py-4 text-lg disabled:opacity-40"
                >
                  {submitting ? "Envoi…" : "Envoyer"}
                </button>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  )
}

function PhotoSlot({
  label,
  preview,
  busy,
  onFile,
}: {
  label: string
  preview: string | null
  busy: boolean
  onFile: (file: File) => void
}) {
  return (
    <label className="block rounded-2xl bg-white text-slate-800 p-5 cursor-pointer">
      <span className="text-xs uppercase tracking-wide text-slate-400 font-semibold">{label}</span>
      {preview ? (
        // Prévisualisation locale / blob : next/image ne gère pas les object URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="mt-3 w-full h-48 object-cover rounded-xl bg-slate-100" />
      ) : (
        <div className="mt-3 h-48 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-sm font-semibold">
          {busy ? "Envoi…" : "Appuyer pour photographier"}
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ""
        }}
      />
    </label>
  )
}
