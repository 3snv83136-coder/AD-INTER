import { NextResponse } from "next/server"
import { persistFacture } from "@/lib/persist"
import { getSessionUser } from "@/lib/intervention-access"
import { dbNotConfiguredResponse, getPrismaOrNull } from "@/lib/db"
import { getParametre } from "@/lib/parametres"
import { TARIF_COMMISSION_RAPPORTEUR, getTarifActif } from "@/lib/tarif"
import { FLUX_RAPPORTEUR, buildCommissionFacture } from "@/lib/rapporteur"
import { canEditFacture } from "@/lib/permissions"
import { findDocumentId } from "@/lib/db-helpers"

export const dynamic = "force-dynamic"

type Params = { params: { id: string } }

export async function POST(_req: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  if (user.role === "tech") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const interv = await prisma.intervention.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { nom: true, ville: true } },
      sousTraitant: true,
    },
  })
  if (!interv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })
  if (interv.flux !== FLUX_RAPPORTEUR) {
    return NextResponse.json({ error: "Cette intervention n’est pas un apport d’affaires" }, { status: 400 })
  }
  if (!interv.sousTraitant) {
    return NextResponse.json({ error: "Aucun sous-traitant assigné" }, { status: 400 })
  }
  if (interv.rapporteur_facture_id) {
    return NextResponse.json({
      ok: true,
      already: true,
      factureId: interv.rapporteur_facture_id,
    })
  }

  const tarif = await getTarifActif(TARIF_COMMISSION_RAPPORTEUR)
  if (!tarif) {
    return NextResponse.json({
      error: `Tarif ${TARIF_COMMISSION_RAPPORTEUR} introuvable. Ajoute-le dans la table tarifs.`,
    }, { status: 500 })
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

  if (user.role && !canEditFacture(user.role)) {
    const existing = await findDocumentId("facture", facture.numero)
    if (existing) {
      return NextResponse.json(
        { error: "Cette action est réservée à l’administrateur." },
        { status: 403 },
      )
    }
  }

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
    return NextResponse.json({ error: "Création de la facture impossible" }, { status: 500 })
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

  return NextResponse.json({
    ok: true,
    factureId,
    numero: facture.numero,
    totalHT,
    totalTTC,
    label: tarif.label,
    prix_ht: Number(tarif.prix_min),
  })
}
