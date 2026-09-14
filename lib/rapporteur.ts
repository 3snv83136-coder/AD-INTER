import type { FactureData } from "@/components/FacturePDF"
import type { Tarif } from "@/lib/types"

export const FLUX_CRM = "crm"
export const FLUX_RAPPORTEUR = "rapporteur"

export function isRapporteurFlux(v: unknown): boolean {
  return v === FLUX_RAPPORTEUR
}

export function nextFactureNumero(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const seq = String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0")
  return `FA-${y}${m}${day}-${seq}`
}

export function buildCommissionFacture(opts: {
  tarif: Tarif
  tvaTaux: number
  reference: string | null
  clientNom: string | null
  ville: string | null
  typeIntervention: string | null
  dateIntervention: string | null
}): FactureData {
  const pu = Number(opts.tarif.prix_min)
  const date = opts.dateIntervention || new Date().toISOString().slice(0, 10)
  const ref = opts.reference || ""
  return {
    numero: nextFactureNumero(),
    date_facture: date,
    echeance: "À réception",
    objet: opts.tarif.label,
    reference_dossier: ref ? `Apport d'affaires ${ref}` : "Apport d'affaires",
    lignes: [
      {
        designation: opts.tarif.label,
        description: [
          opts.clientNom ? `Client : ${opts.clientNom}` : null,
          opts.typeIntervention,
          opts.ville,
          ref ? `Dossier ${ref}` : null,
        ]
          .filter(Boolean)
          .join(" — "),
        qte: 1,
        unite: opts.tarif.unite || "forfait",
        pu_ht: pu,
        inclus: false,
      },
    ],
    tva_taux: opts.tvaTaux,
    mode_reglement: "",
    observations: "Commission d'apport d'affaires — intervention réalisée par sous-traitance.",
  }
}
