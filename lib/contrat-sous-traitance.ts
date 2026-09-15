import crypto from "crypto"
import { renderToBuffer } from "@react-pdf/renderer"
import { Resend } from "resend"
import { buildContratDocument } from "@/components/apport/ContratSousTraitancePDF"
import { BRAND_NAME, CONTACT_EMAIL } from "@/lib/brand"
import { EMAIL_RE, escapeHtml, getResendFromEmail, getResendRecipient } from "@/lib/email-utils"
import { getPrismaOrNull } from "@/lib/db"
import { getAppBaseUrl } from "@/lib/apport-token"
import { getParametre, getTelPrincipal } from "@/lib/parametres"
import { parseSousTraitantNotes } from "@/lib/sous-traitant-notes"
import { CGU_SOUS_TRAITANCE_VERSION } from "@/lib/sous-traitance-cgu"
import { blobPaths, uploadBlob } from "@/lib/storage"

export type AcceptationInput = {
  interventionId: string
  sousTraitantId: string
  signatureDataUrl: string
  ip: string | null
  userAgent: string | null
}

export type AcceptationOk = {
  ok: true
  already: boolean
  contratId: string
  pris_en_charge_at: string
}

export type AcceptationErr = {
  ok: false
  error: string
  status: number
}

function parseSignature(dataUrl: string): { buf: Buffer; mime: "png" | "jpeg" } | null {
  const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl.trim())
  if (!m) return null
  const buf = Buffer.from(m[2], "base64")
  if (buf.length < 200 || buf.length > 2 * 1024 * 1024) return null
  return { buf, mime: m[1] === "jpeg" ? "jpeg" : "png" }
}

function fmtDateHeureFR(d: Date): string {
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export async function accepterSousTraitance(
  input: AcceptationInput,
): Promise<AcceptationOk | AcceptationErr> {
  const prisma = getPrismaOrNull()
  if (!prisma) return { ok: false, error: "Service indisponible", status: 503 }

  const sig = parseSignature(input.signatureDataUrl)
  if (!sig) return { ok: false, error: "Signature manquante ou invalide", status: 400 }

  const interv = await prisma.intervention.findUnique({
    where: { id: input.interventionId },
    include: {
      sousTraitant: true,
    },
  })
  if (!interv || !interv.sousTraitant) {
    return { ok: false, error: "Intervention introuvable", status: 404 }
  }
  if (interv.sousTraitant.id !== input.sousTraitantId) {
    return { ok: false, error: "Lien invalide", status: 403 }
  }

  const existing = await prisma.contratSousTraitance.findUnique({
    where: { intervention_id: interv.id },
    select: { id: true, created_at: true },
  })
  if (existing) {
    return {
      ok: true,
      already: true,
      contratId: existing.id,
      pris_en_charge_at: existing.created_at.toISOString(),
    }
  }

  const accepteAt = new Date()
  const nonce = crypto.randomBytes(16).toString("hex")
  const preuveHash = crypto
    .createHash("sha256")
    .update(
      [
        interv.id,
        interv.sousTraitant.id,
        accepteAt.toISOString(),
        CGU_SOUS_TRAITANCE_VERSION,
        crypto.createHash("sha256").update(sig.buf).digest("hex"),
      ].join("|"),
    )
    .digest("hex")

  const ext = sig.mime === "jpeg" ? "jpg" : "png"
  let signatureUrl: string
  try {
    signatureUrl = await uploadBlob({
      pathname: blobPaths.contratSousTraitance(interv.id, `sig-${nonce}.${ext}`),
      body: sig.buf,
      contentType: `image/${sig.mime}`,
    })
  } catch (e) {
    return {
      ok: false,
      error: `Archivage signature impossible : ${e instanceof Error ? e.message : "erreur"}`,
      status: 502,
    }
  }

  const parsed = parseSousTraitantNotes(interv.sousTraitant.notes)
  const tel = await getTelPrincipal()
  const datePrevue = interv.date_prevue
    ? interv.date_prevue.toISOString().slice(0, 10).split("-").reverse().join("/")
    : null

  let pdfBuf: Buffer
  try {
    pdfBuf = Buffer.from(
      await renderToBuffer(
        buildContratDocument({
          reference: interv.reference,
          signataireNom: interv.sousTraitant.nom,
          siret: parsed.siret || null,
          telephone: tel,
          typeIntervention: interv.type_intervention,
          ville: interv.ville,
          datePrevue,
          accepteAt: fmtDateHeureFR(accepteAt),
          preuveHash,
          signatureSrc: { data: sig.buf, format: sig.mime === "jpeg" ? "jpg" : "png" },
          ip: input.ip,
        }) as Parameters<typeof renderToBuffer>[0],
      ),
    )
  } catch (e) {
    return {
      ok: false,
      error: `Génération du contrat impossible : ${e instanceof Error ? e.message : "erreur"}`,
      status: 500,
    }
  }

  let pdfUrl: string
  try {
    pdfUrl = await uploadBlob({
      pathname: blobPaths.contratSousTraitance(interv.id, `contrat-${nonce}.pdf`),
      body: pdfBuf,
      contentType: "application/pdf",
    })
  } catch (e) {
    return {
      ok: false,
      error: `Archivage contrat impossible : ${e instanceof Error ? e.message : "erreur"}`,
      status: 502,
    }
  }

  try {
    const created = await prisma.contratSousTraitance.create({
      data: {
        intervention_id: interv.id,
        sous_traitant_id: interv.sousTraitant.id,
        cgu_version: CGU_SOUS_TRAITANCE_VERSION,
        cgu_acceptees_at: accepteAt,
        signature_url: signatureUrl,
        pdf_url: pdfUrl,
        preuve_hash: preuveHash,
        assurance_numero: "",
        siret: parsed.siret || null,
        signataire_nom: interv.sousTraitant.nom,
        ip: input.ip,
        user_agent: input.userAgent,
      },
    })

    if (interv.statut === "planifiee") {
      await prisma.intervention.update({
        where: { id: interv.id },
        data: { statut: "en_cours" },
      })
    }

    notifyPriseEnCharge({
      sousTraitantNom: interv.sousTraitant.nom,
      typeIntervention: interv.type_intervention,
      ville: interv.ville,
      reference: interv.reference,
      accepteAt: fmtDateHeureFR(accepteAt),
    }).catch((err) => console.error("[contrat-sous-traitance notify]", err))

    return {
      ok: true,
      already: false,
      contratId: created.id,
      pris_en_charge_at: created.created_at.toISOString(),
    }
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code === "P2002") {
      const again = await prisma.contratSousTraitance.findUnique({
        where: { intervention_id: interv.id },
        select: { id: true, created_at: true },
      })
      if (again) {
        return {
          ok: true,
          already: true,
          contratId: again.id,
          pris_en_charge_at: again.created_at.toISOString(),
        }
      }
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Enregistrement impossible",
      status: 500,
    }
  }
}

async function notifyPriseEnCharge(opts: {
  sousTraitantNom: string
  typeIntervention: string | null
  ville: string | null
  reference: string | null
  accepteAt: string
}): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return
  const to = await getParametre("EMAIL_RAPPORTEUR", CONTACT_EMAIL)
  if (!EMAIL_RE.test(to)) return
  const resend = new Resend(resendKey)
  const dossierUrl = `${getAppBaseUrl()}/rapporteur`
  await resend.emails.send({
    from: `${BRAND_NAME} <${getResendFromEmail()}>`,
    to: getResendRecipient(to),
    subject: `Prise en charge — ${opts.sousTraitantNom}${opts.ville ? ` · ${opts.ville}` : ""}`,
    html: `
      <p>Le sous-traitant <strong>${escapeHtml(opts.sousTraitantNom)}</strong> a lu l’intervention, accepté les conditions générales et signé.</p>
      <ul>
        <li><strong>Type :</strong> ${escapeHtml(opts.typeIntervention || "—")}</li>
        <li><strong>Ville :</strong> ${escapeHtml(opts.ville || "—")}</li>
        ${opts.reference ? `<li><strong>Dossier :</strong> ${escapeHtml(opts.reference)}</li>` : ""}
        <li><strong>Horodatage :</strong> ${escapeHtml(opts.accepteAt)}</li>
      </ul>
      <p>Un signal apparaît dans le CRM dès la signature. Le contrat de sous-traitance est archivé et visible uniquement dans le rapporteur (onglet Rapports).</p>
      <p><a href="${escapeHtml(dossierUrl)}">Ouvrir le rapporteur</a></p>
    `,
  })
}
