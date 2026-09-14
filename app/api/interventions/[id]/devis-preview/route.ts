import { NextRequest, NextResponse } from "next/server"
import { getPrismaOrNull, dbNotConfiguredResponse } from "@/lib/db"
import { buildDevisFromRapport } from "@/lib/rapportToDevis"

export const dynamic = "force-dynamic"

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const interventionId = params.id
  if (!interventionId) return NextResponse.json({ error: "ID intervention manquant" }, { status: 400 })

  const interv = await prisma.intervention.findUnique({
    where: { id: interventionId },
    select: {
      id: true, reference: true, client_id: true, agence: true, type_intervention: true,
      adresse_chantier: true, ville: true, code_postal: true, date_realisee: true,
      date_prevue: true, rapport_json: true,
    },
  })
  if (!interv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

  if (!interv.rapport_json || Object.keys(interv.rapport_json as object).length === 0) {
    return NextResponse.json({ error: "Aucun rapport — complète l'étape rapport d'abord." }, { status: 400 })
  }

  let client: {
    nom: string | null
    email: string | null
    adresse: string | null
    code_postal: string | null
    ville: string | null
  } | null = null
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

  const prefill = buildDevisFromRapport({
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

  return NextResponse.json({ prefill, agence: interv.agence })
}
