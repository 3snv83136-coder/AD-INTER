import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { Resend } from "resend"
import { BRAND_NAME, CONTACT_EMAIL } from "@/lib/brand"
import { getPrismaOrNull } from "@/lib/db"
import { EMAIL_RE, escapeHtml, getResendFromEmail, getResendRecipient } from "@/lib/email-utils"
import { getAppBaseUrl } from "@/lib/apport-token"
import {
  PHOTO_SLOT_APRES,
  PHOTO_SLOT_AVANT,
  jsonObject,
  loadApportContext,
  parseMontant,
  photoUrlForSlot,
} from "@/lib/apport"
import { getParametre } from "@/lib/parametres"
import { cloturerRapporteurIntervention } from "@/lib/rapporteur"

export const dynamic = "force-dynamic"
export const maxDuration = 30

type Params = { params: { token: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const loaded = await loadApportContext(params.token)
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  }
  const accepted = loaded.ctx.pris_en_charge
  const teaser = {
    type_intervention: loaded.ctx.affaire.type_intervention,
    date_prevue: loaded.ctx.affaire.date_prevue,
    heure_prevue: loaded.ctx.affaire.heure_prevue,
    ville: loaded.ctx.affaire.ville,
    adresse: "",
    client_nom: null,
    client_telephone: null,
    client_email: null,
    notes: null,
    sous_traitant_nom: loaded.ctx.affaire.sous_traitant_nom,
    already: false,
    photo_avant: null,
    photo_apres: null,
  }
  return NextResponse.json({
    ok: true,
    already: loaded.ctx.already,
    pris_en_charge: accepted,
    needs_acceptation: !accepted,
    affaire: accepted ? loaded.ctx.affaire : teaser,
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const loaded = await loadApportContext(params.token)
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  }
  if (loaded.ctx.already) {
    return NextResponse.json({ error: "Ce dossier a déjà été envoyé.", already: true }, { status: 409 })
  }
  if (!loaded.ctx.pris_en_charge) {
    return NextResponse.json(
      { error: "Accepte d’abord les conditions générales et signe pour prendre l’intervention." },
      { status: 403 },
    )
  }

  let body: { rapport?: unknown; montant?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const rapport = typeof body.rapport === "string" ? body.rapport.trim() : ""
  if (rapport.length < 8) {
    return NextResponse.json({ error: "Le rapport est trop court." }, { status: 400 })
  }
  const montant = parseMontant(body.montant)
  if (montant == null) {
    return NextResponse.json({ error: "Montant de l’intervention invalide." }, { status: 400 })
  }

  const avant = photoUrlForSlot(loaded.ctx.photos_urls, loaded.ctx.photos_legendes, PHOTO_SLOT_AVANT)
  const apres = photoUrlForSlot(loaded.ctx.photos_urls, loaded.ctx.photos_legendes, PHOTO_SLOT_APRES)
  if (!avant || !apres) {
    return NextResponse.json({ error: "Les photos avant et après sont obligatoires." }, { status: 400 })
  }

  const prisma = getPrismaOrNull()
  if (!prisma) {
    return NextResponse.json({ error: "Service indisponible" }, { status: 503 })
  }

  const nextJson: Prisma.InputJsonValue = {
    ...jsonObject(loaded.ctx.rapport_json),
    apport: {
      rapport,
      montant,
      soumis_at: new Date().toISOString(),
    },
  }

  await prisma.intervention.update({
    where: { id: loaded.ctx.interventionId },
    data: {
      prix_prevu: montant,
      rapport_json: nextJson,
    },
  })

  const cloture = await cloturerRapporteurIntervention(loaded.ctx.interventionId)
  if (!cloture.ok) {
    return NextResponse.json({ error: cloture.error }, { status: cloture.status })
  }

  try {
    await notifyAlloDebouchage({
      affaire: loaded.ctx.affaire,
      rapport,
      montant,
      photoAvant: avant,
      photoApres: apres,
      factureNumero: cloture.numero,
    })
  } catch {
    /* l’envoi interne ne bloque pas la clôture */
  }

  return NextResponse.json({
    ok: true,
    already: cloture.already,
    factureId: cloture.factureId,
    numero: cloture.numero,
  })
}

async function notifyAlloDebouchage(opts: {
  affaire: {
    type_intervention: string | null
    ville: string | null
    adresse: string
    client_nom: string | null
    sous_traitant_nom: string
  }
  rapport: string
  montant: number
  photoAvant: string
  photoApres: string
  factureNumero: string | null
}): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return
  const to = await getParametre("EMAIL_RAPPORTEUR", CONTACT_EMAIL)
  if (!EMAIL_RE.test(to)) return
  const resend = new Resend(resendKey)
  const dossierUrl = `${getAppBaseUrl()}/rapporteur`
  const montantFmt = opts.montant.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  await resend.emails.send({
    from: `${BRAND_NAME} <${getResendFromEmail()}>`,
    to: getResendRecipient(to),
    subject: `Rapport apporteur — ${opts.affaire.sous_traitant_nom}${opts.affaire.ville ? ` · ${opts.affaire.ville}` : ""}`,
    html: `
      <p>L’apporteur <strong>${escapeHtml(opts.affaire.sous_traitant_nom)}</strong> a envoyé son rapport.</p>
      <ul>
        <li><strong>Client :</strong> ${escapeHtml(opts.affaire.client_nom || "—")}</li>
        <li><strong>Type :</strong> ${escapeHtml(opts.affaire.type_intervention || "—")}</li>
        <li><strong>Adresse :</strong> ${escapeHtml(opts.affaire.adresse || "—")}</li>
        <li><strong>Montant intervention :</strong> ${escapeHtml(montantFmt)} €</li>
        ${opts.factureNumero ? `<li><strong>Facture commission :</strong> ${escapeHtml(opts.factureNumero)}</li>` : ""}
      </ul>
      <p><strong>Rapport</strong></p>
      <p>${escapeHtml(opts.rapport).replace(/\n/g, "<br/>")}</p>
      <p>
        <a href="${escapeHtml(opts.photoAvant)}">Photo avant</a>
        ·
        <a href="${escapeHtml(opts.photoApres)}">Photo après</a>
      </p>
      <p><a href="${escapeHtml(dossierUrl)}">Ouvrir le rapporteur</a></p>
    `,
  })
}
