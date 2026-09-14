import { NextRequest, NextResponse } from "next/server"
import { getPrismaOrNull, dbNotConfiguredResponse } from "@/lib/db"
import { buildFactureFromRapport } from "@/lib/rapportToFacture"
import { persistFacture } from "@/lib/persist"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const interventionId = params.id
  if (!interventionId) {
    return NextResponse.json({ error: 'ID intervention manquant' }, { status: 400 })
  }

  type LigneInput = {
    designation?: string
    description?: string
    qte?: number
    unite?: string
    pu_ht?: number
    inclus?: boolean
  }

  let body: {
    pu_ht?: number
    mode_reglement?: string
    echeance?: string
    tva_taux?: number
    observations?: string
    recommandation?: string
    lignes?: LigneInput[]
    objet?: string
  } = {}
  try {
    body = await req.json()
  } catch {
    // Body optionnel
  }

  const interv = await prisma.intervention.findUnique({
    where: { id: interventionId },
    select: {
      id: true, reference: true, client_id: true, technicien_id: true, agence: true,
      type_intervention: true, adresse_chantier: true, ville: true, code_postal: true,
      date_realisee: true, date_prevue: true, rapport_json: true, terrain_step: true,
    },
  })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  if (!interv.rapport_json || Object.keys(interv.rapport_json as object).length === 0) {
    return NextResponse.json({
      error: 'Aucun rapport pour cette intervention. Dicte le rapport d\'abord.',
    }, { status: 400 })
  }

  let client: { nom: string | null; email: string | null; adresse: string | null; code_postal: string | null; ville: string | null } | null = null
  if (interv.client_id) {
    client = await prisma.client.findUnique({
      where: { id: interv.client_id },
      select: { nom: true, email: true, adresse: true, code_postal: true, ville: true },
    })
  }

  const dateIntervention = interv.date_realisee
    ? interv.date_realisee.toISOString().slice(0, 10)
    : interv.date_prevue
      ? interv.date_prevue.toISOString().slice(0, 10)
      : null

  const prefill = buildFactureFromRapport({
    rapport: interv.rapport_json as unknown as import("@/components/RealisationPDF").RapportData,
    client_nom: client?.nom || null,
    client_email: client?.email || null,
    client_adresse: client?.adresse || null,
    client_code_postal: client?.code_postal || null,
    client_ville: client?.ville || null,
    adresse_chantier: interv.adresse_chantier || null,
    type_intervention: interv.type_intervention || null,
    date_intervention: dateIntervention,
    reference: interv.reference || null,
  })

  const facture = prefill.facture

  if (Array.isArray(body.lignes) && body.lignes.length > 0) {
    facture.lignes = body.lignes
      .map(l => ({
        designation: typeof l?.designation === 'string' ? l.designation.trim() : '',
        description: typeof l?.description === 'string' ? l.description : '',
        qte: Number.isFinite(Number(l?.qte)) ? Number(l.qte) : 1,
        unite: typeof l?.unite === 'string' && l.unite.trim() ? l.unite : 'forfait',
        pu_ht: Number.isFinite(Number(l?.pu_ht)) ? Number(l.pu_ht) : 0,
        inclus: l?.inclus === true,
      }))
      .filter(l => l.designation.length > 0)
  } else if (typeof body.pu_ht === 'number' && Number.isFinite(body.pu_ht) && facture.lignes[0]) {
    facture.lignes[0] = { ...facture.lignes[0], pu_ht: body.pu_ht }
  }

  if (typeof body.mode_reglement === 'string') facture.mode_reglement = body.mode_reglement
  if (typeof body.echeance === 'string' && body.echeance.trim()) facture.echeance = body.echeance.trim()
  if (body.tva_taux === 0 || body.tva_taux === 10 || body.tva_taux === 20) facture.tva_taux = body.tva_taux
  if (typeof body.observations === 'string') facture.observations = body.observations
  if (typeof body.recommandation === 'string') facture.recommandation = body.recommandation
  if (typeof body.objet === 'string' && body.objet.trim()) facture.objet = body.objet.trim()

  const totalHT = facture.lignes.reduce((sum: number, l) => sum + (l.inclus ? 0 : (Number(l.qte) || 0) * (Number(l.pu_ht) || 0)), 0)
  const totalTTC = totalHT * (1 + (facture.tva_taux ?? 10) / 100)

  const factureId = await persistFacture({
    facture,
    clientNom: prefill.client_nom,
    clientEmail: prefill.client_email,
    clientAdresse: prefill.client_adresse,
    clientCP: prefill.client_cp,
    ville: prefill.client_ville,
    agence: interv.agence,
    numero: facture.numero,
    totalHT,
    totalTTC,
    tvaTaux: facture.tva_taux,
    echeance: facture.echeance,
    interventionId,
    emailSent: false,
  })

  if (!factureId) {
    return NextResponse.json({ error: 'Sauvegarde facture impossible' }, { status: 500 })
  }

  const currentStep = interv.terrain_step ?? 0
  if (currentStep < 5) {
    await prisma.intervention.update({
      where: { id: interventionId },
      data: { terrain_step: 5 },
    })
  }

  return NextResponse.json({
    ok: true,
    factureId,
    facture,
    totalHT,
    totalTTC,
  })
}
