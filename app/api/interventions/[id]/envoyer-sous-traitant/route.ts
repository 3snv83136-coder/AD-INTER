import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { EMAIL_RE, escapeHtml, getResendFromEmail, getResendRecipient } from "@/lib/email-utils"
import { getSessionUser } from "@/lib/intervention-access"
import { dbNotConfiguredResponse, getPrismaOrNull } from "@/lib/db"
import { getTelPrincipal } from "@/lib/parametres"
import { BRAND_NAME } from "@/lib/brand"
import { FLUX_RAPPORTEUR } from "@/lib/rapporteur"
import { apportPageUrl, signApportToken } from "@/lib/apport-token"
import { buildSmsUri, normalizePhoneForSmsUri } from "@/lib/sms"

export const dynamic = "force-dynamic"
export const maxDuration = 30

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
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
      client: { select: { nom: true, email: true, telephone: true } },
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

  const st = interv.sousTraitant
  const clientNom = interv.client?.nom || "Client"
  const dateStr = interv.date_prevue
    ? interv.date_prevue.toISOString().slice(0, 10).split("-").reverse().join("/")
    : "—"
  const heure = interv.heure_prevue
    ? `${String(interv.heure_prevue.getUTCHours()).padStart(2, "0")}:${String(interv.heure_prevue.getUTCMinutes()).padStart(2, "0")}`
    : ""
  const adresse = [interv.adresse_chantier, interv.code_postal, interv.ville].filter(Boolean).join(" ")
  const tel = await getTelPrincipal()
  const token = await signApportToken(interv.id, st.id)
  const portailUrl = apportPageUrl(token)

  const smsBody = [
    `${BRAND_NAME} — apport d'affaires`,
    interv.type_intervention || "Intervention",
    `${dateStr}${heure ? ` ${heure}` : ""}`,
    clientNom,
    interv.client?.telephone || "",
    adresse,
    `Rapport + photos : ${portailUrl}`,
  ]
    .filter(Boolean)
    .join("\n")

  let smsUri: string | null = null
  if (st.telephone && normalizePhoneForSmsUri(st.telephone)) {
    try {
      smsUri = buildSmsUri(st.telephone, smsBody)
    } catch {
      smsUri = null
    }
  }

  let emailId: string | null = null
  if (st.email && EMAIL_RE.test(st.email)) {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      return NextResponse.json({ error: "RESEND_API_KEY manquante" }, { status: 500 })
    }
    const resend = new Resend(resendKey)
    const recipient = getResendRecipient(st.email)
    const result = await resend.emails.send({
      from: `${BRAND_NAME} <${getResendFromEmail()}>`,
      to: recipient,
      subject: `${interv.urgence ? "URGENT — " : ""}Apport d'affaires ${interv.ville ? `à ${interv.ville}` : ""}`.trim(),
      html: `
        <p>Bonjour ${escapeHtml(st.nom)},</p>
        <p>${escapeHtml(BRAND_NAME)} vous transmet une intervention à réaliser (sous-traitance).</p>
        <ul>
          <li><strong>Type :</strong> ${escapeHtml(interv.type_intervention || "—")}</li>
          <li><strong>Date :</strong> ${escapeHtml(dateStr)} ${escapeHtml(heure)}</li>
          <li><strong>Client :</strong> ${escapeHtml(clientNom)}</li>
          <li><strong>Téléphone :</strong> ${escapeHtml(interv.client?.telephone || "—")}</li>
          <li><strong>Adresse :</strong> ${escapeHtml(adresse || "—")}</li>
          ${interv.notes_internes ? `<li><strong>Notes :</strong> ${escapeHtml(interv.notes_internes)}</li>` : ""}
        </ul>
        <p>
          Après l’intervention, ouvrez ce lien pour envoyer les photos avant / après, le rapport et le montant :<br/>
          <a href="${escapeHtml(portailUrl)}">${escapeHtml(portailUrl)}</a>
        </p>
        <p>${escapeHtml(BRAND_NAME)} — ${escapeHtml(tel)}</p>
      `,
    })
    if (result.error) {
      return NextResponse.json({
        error: `Envoi email impossible : ${result.error.message || String(result.error)}`,
      }, { status: 500 })
    }
    emailId = result.data?.id || null
  } else if (!smsUri) {
    return NextResponse.json({
      error: "Le sous-traitant n’a ni email valide ni téléphone pour l’envoi.",
    }, { status: 400 })
  }

  await prisma.intervention.update({
    where: { id: interv.id },
    data: {
      rapporteur_envoye_at: new Date(),
      statut: interv.statut === "planifiee" ? "en_cours" : interv.statut,
    },
  })

  return NextResponse.json({
    ok: true,
    email_id: emailId,
    sms_uri: smsUri,
    sms_body: smsBody,
    apport_url: portailUrl,
  })
}
