import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, assertInterventionAccess } from "@/lib/intervention-access"
import { buildRapportFactureSmsText } from "@/lib/rapport-facture-message"
import { getTelPrincipal, getParametre } from "@/lib/parametres"
import { normalizePhoneForSmsUri } from "@/lib/sms"
import { getPrismaOrNull, dbNotConfiguredResponse } from "@/lib/db"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  let body: { interventionId?: string; clientPhone?: string; markSent?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const interventionId = (body.interventionId || "").trim()
  const clientPhone = (body.clientPhone || "").trim()
  if (!interventionId) {
    return NextResponse.json({ error: "interventionId requis" }, { status: 400 })
  }
  if (!clientPhone || !normalizePhoneForSmsUri(clientPhone)) {
    return NextResponse.json({ error: "Numéro de téléphone client invalide" }, { status: 400 })
  }

  const user = await getSessionUser()
  const access = await assertInterventionAccess(interventionId, user)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const interv = await prisma.intervention.findUnique({
    where: { id: interventionId },
    select: {
      id: true, reference: true, ville: true, date_realisee: true, date_prevue: true,
      client_id: true, technicien_id: true, pdf_rapport_url: true,
    },
  })
  if (!interv) {
    return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })
  }
  if (!interv.pdf_rapport_url) {
    return NextResponse.json({
      error: "Aucun PDF rapport en ligne — génère d'abord les documents (comme pour le mail).",
    }, { status: 400 })
  }

  const facture = await prisma.document.findFirst({
    where: { intervention_id: interventionId, type: "facture" },
    orderBy: { created_at: "desc" },
    select: { id: true, numero: true, montant_ttc: true, pdf_url: true },
  })
  if (!facture?.pdf_url) {
    return NextResponse.json({ error: "Facture PDF introuvable — crée la facture d'abord." }, { status: 400 })
  }

  let clientNom = ""
  if (interv.client_id) {
    const cl = await prisma.client.findUnique({
      where: { id: interv.client_id },
      select: { nom: true },
    })
    if (cl?.nom) clientNom = cl.nom
  }

  let technicienNom = "votre technicien"
  if (interv.technicien_id) {
    const t = await prisma.technicien.findUnique({
      where: { id: interv.technicien_id },
      select: { nom: true },
    })
    if (t?.nom) technicienNom = t.nom
  }

  let reviewUrl = process.env.GOOGLE_REVIEW_URL
    || "https://www.google.com/maps/place/Les+Techniciens+du+Débouchage"
  try {
    const paramVal = await getParametre("google_review_url", "")
    if (paramVal) reviewUrl = paramVal
  } catch { /* best-effort */ }

  const tel = await getTelPrincipal()
  const smsBody = buildRapportFactureSmsText({
    clientNom,
    technicienNom,
    ville: interv.ville || "",
    dateIntervention: interv.date_realisee
      ? interv.date_realisee.toISOString().slice(0, 10)
      : interv.date_prevue
        ? interv.date_prevue.toISOString().slice(0, 10)
        : "",
    reference: interv.reference || interv.id.slice(0, 8),
    factureNumero: facture.numero || "",
    totalTTC: facture.montant_ttc != null ? Number(facture.montant_ttc) : null,
    reviewUrl,
    tel,
    rapportUrl: interv.pdf_rapport_url,
    factureUrl: facture.pdf_url,
  })

  if (body.markSent !== false) {
    try {
      await prisma.intervention.update({
        where: { id: interventionId },
        data: { sms_envoye_at: new Date() },
      })
    } catch { /* best-effort */ }

    if (interv.client_id) {
      try {
        await prisma.client.update({
          where: { id: interv.client_id },
          data: { telephone: normalizePhoneForSmsUri(clientPhone) || clientPhone },
        })
      } catch { /* best-effort */ }
    }
  }

  return NextResponse.json({ ok: true, body: smsBody })
}
