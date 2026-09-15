import type { FactureData } from "@/components/FacturePDF"
import { persistFacture } from "@/lib/persist"
import { getPrismaOrNull } from "@/lib/db"
import { getParametre } from "@/lib/parametres"
import { TARIF_COMMISSION_RAPPORTEUR, getTarifActif } from "@/lib/tarif"
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

export type ClotureRapporteurOk = {
  ok: true
  already: boolean
  factureId: string
  numero: string | null
  totalHT: number
  totalTTC: number
  label: string
  prix_ht: number
}

export type ClotureRapporteurErr = {
  ok: false
  error: string
  status: number
}

export async function cloturerRapporteurIntervention(
  interventionId: string,
): Promise<ClotureRapporteurOk | ClotureRapporteurErr> {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    return { ok: false, error: "Base de données non configurée", status: 503 }
  }

  const interv = await prisma.intervention.findUnique({
    where: { id: interventionId },
    include: {
      client: { select: { nom: true, ville: true } },
      sousTraitant: true,
    },
  })
  if (!interv) return { ok: false, error: "Intervention introuvable", status: 404 }
  if (interv.flux !== FLUX_RAPPORTEUR) {
    return { ok: false, error: "Cette intervention n’est pas un apport d’affaires", status: 400 }
  }
  if (!interv.sousTraitant) {
    return { ok: false, error: "Aucun sous-traitant assigné", status: 400 }
  }
  if (interv.rapporteur_facture_id) {
    return {
      ok: true,
      already: true,
      factureId: interv.rapporteur_facture_id,
      numero: null,
      totalHT: 0,
      totalTTC: 0,
      label: "",
      prix_ht: 0,
    }
  }

  const tarif = await getTarifActif(TARIF_COMMISSION_RAPPORTEUR)
  if (!tarif) {
    return {
      ok: false,
      error: `Tarif ${TARIF_COMMISSION_RAPPORTEUR} introuvable. Ajoute-le dans la table tarifs.`,
      status: 500,
    }
  }

  const tvaStr = await getParametre("TVA_RAPPORTEUR", "20")
  const tvaTaux = tvaStr === "0" || tvaStr === "10" || tvaStr === "20" ? Number(tvaStr) : 20

  const dateIntervention = interv.date_realisee
    ? interv.date_realisee.toISOString().slice(0, 10)
    : interv.date_prevue
      ? interv.date_prevue.toISOString().slice(0, 10)
      : null

  const facture = buildCommissionFacture({
    tarif,
    tvaTaux,
    reference: interv.reference,
    clientNom: interv.client?.nom || null,
    ville: interv.ville || interv.client?.ville || null,
    typeIntervention: interv.type_intervention,
    dateIntervention,
  })

  const totalHT = facture.lignes.reduce(
    (sum, l) => sum + (l.inclus ? 0 : (Number(l.qte) || 0) * (Number(l.pu_ht) || 0)),
    0,
  )
  const totalTTC = totalHT * (1 + tvaTaux / 100)

  const factureId = await persistFacture({
    facture,
    clientNom: interv.sousTraitant.nom,
    clientEmail: interv.sousTraitant.email,
    ville: interv.ville,
    agence: interv.agence,
    numero: facture.numero,
    totalHT,
    totalTTC,
    tvaTaux,
    echeance: facture.echeance,
    interventionId: interv.id,
    emailSent: false,
  })

  if (!factureId) {
    return { ok: false, error: "Création de la facture impossible", status: 500 }
  }

  const now = new Date()
  await prisma.intervention.update({
    where: { id: interv.id },
    data: {
      statut: "terminee",
      date_realisee: new Date(now.toISOString().slice(0, 10)),
      heure_fin_reelle: now,
      rapporteur_facture_id: factureId,
    },
  })

  return {
    ok: true,
    already: false,
    factureId,
    numero: facture.numero,
    totalHT,
    totalTTC,
    label: tarif.label,
    prix_ht: Number(tarif.prix_min),
  }
}
