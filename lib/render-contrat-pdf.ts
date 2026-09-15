import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import { BRAND_NAME } from "@/lib/brand"
import { ALLO_ADRESSE_LIGNES, ALLO_RCS, ALLO_SIRET } from "@/lib/entreprise"
import {
  CGU_SOUS_TRAITANCE_PARAGRAPHES,
  CGU_SOUS_TRAITANCE_VERSION,
} from "@/lib/sous-traitance-cgu"

export type ContratPdfInput = {
  reference: string | null
  signataireNom: string
  siret: string | null
  telephone: string
  typeIntervention: string | null
  ville: string | null
  datePrevue: string | null
  accepteAt: string
  preuveHash: string
  signaturePng: Buffer
  ip: string | null
}

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 48
const NAVY = rgb(14 / 255, 42 / 255, 82 / 255)
const MUTED = rgb(100 / 255, 116 / 255, 139 / 255)
const TEXT = rgb(30 / 255, 41 / 255, 59 / 255)

/** Helvetica WinAnsi : apostrophes typographiques et tirets longs cassent le PDF. */
function pdfSafe(raw: string): string {
  return raw
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u0153/g, "oe")
    .replace(/\u0152/g, "OE")
    .replace(/\u00A0/g, " ")
}

function wrap(font: PDFFont, size: number, text: string, maxWidth: number): string[] {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

type Ctx = {
  doc: PDFDocument
  page: PDFPage
  y: number
  font: PDFFont
  bold: PDFFont
}

function ensureSpace(ctx: Ctx, need: number): void {
  if (ctx.y - need >= MARGIN + 28) return
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H])
  ctx.y = PAGE_H - MARGIN
}

function drawLines(
  ctx: Ctx,
  lines: string[],
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  lineGap: number,
): void {
  const maxW = PAGE_W - MARGIN * 2
  for (const line of lines) {
    ensureSpace(ctx, size + lineGap)
    ctx.page.drawText(line, { x: MARGIN, y: ctx.y, size, font, color })
    ctx.y -= size + lineGap
  }
}

export async function renderContratPdf(input: ContratPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([PAGE_W, PAGE_H])
  const ctx: Ctx = { doc, page, y: PAGE_H - MARGIN, font, bold }
  const maxW = PAGE_W - MARGIN * 2

  drawLines(ctx, [pdfSafe(BRAND_NAME)], bold, 14, NAVY, 4)
  drawLines(ctx, wrap(font, 8, ALLO_ADRESSE_LIGNES.join(" · "), maxW), font, 8, MUTED, 3)
  const meta = [ALLO_SIRET ? `SIRET ${ALLO_SIRET}` : null, ALLO_RCS, input.telephone]
    .filter(Boolean)
    .join(" · ")
  if (meta) drawLines(ctx, wrap(font, 8, meta, maxW), font, 8, MUTED, 3)

  ctx.y -= 10
  drawLines(ctx, wrap(bold, 12, "Contrat de sous-traitance - acceptation electronique", maxW), bold, 12, NAVY, 6)
  ctx.y -= 6

  drawLines(ctx, ["Sous-traitant signataire"], font, 7.5, MUTED, 3)
  drawLines(ctx, wrap(bold, 11, input.signataireNom, maxW), bold, 11, TEXT, 4)
  drawLines(
    ctx,
    wrap(font, 8, input.siret ? `SIRET ${input.siret}` : "SIRET non renseigne", maxW),
    font,
    8,
    MUTED,
    4,
  )
  ctx.y -= 8

  drawLines(ctx, ["Intervention confiee"], font, 7.5, MUTED, 3)
  drawLines(ctx, wrap(bold, 11, input.typeIntervention || "Intervention", maxW), bold, 11, TEXT, 4)
  const aff = [input.reference ? `Dossier ${input.reference}` : null, input.datePrevue, input.ville]
    .filter(Boolean)
    .join(" · ")
  if (aff) drawLines(ctx, wrap(font, 8, aff, maxW), font, 8, MUTED, 4)
  ctx.y -= 10

  for (const para of CGU_SOUS_TRAITANCE_PARAGRAPHES) {
    drawLines(ctx, wrap(font, 8.5, para, maxW), font, 8.5, TEXT, 3)
    ctx.y -= 6
  }

  ctx.y -= 4
  drawLines(ctx, ["Signature electronique"], font, 7.5, MUTED, 3)
  const sigMeta = `Accepte le ${input.accepteAt}${input.ip ? ` · IP ${input.ip}` : ""} · CGU ${CGU_SOUS_TRAITANCE_VERSION}`
  drawLines(ctx, wrap(font, 8, sigMeta, maxW), font, 8, MUTED, 4)

  try {
    let img
    try {
      img = await doc.embedPng(input.signaturePng)
    } catch {
      img = await doc.embedJpg(input.signaturePng)
    }
    const sigW = 180
    const sigH = Math.min(70, (img.height / img.width) * sigW)
    ensureSpace(ctx, sigH + 8)
    ctx.page.drawImage(img, { x: MARGIN, y: ctx.y - sigH, width: sigW, height: sigH })
    ctx.y -= sigH + 12
  } catch (e) {
    console.error("[contrat-pdf] signature image", e)
    drawLines(ctx, ["Signature archivee (image jointe au dossier)."], font, 8, MUTED, 4)
  }

  const footer = pdfSafe(
    `Document interne ${BRAND_NAME} - non communicable au sous-traitant. Empreinte ${input.preuveHash}`,
  )
  const footerLines = wrap(font, 7, footer, maxW)
  let fy = 28 + (footerLines.length - 1) * 9
  for (const line of footerLines) {
    ctx.page.drawText(line, { x: MARGIN, y: fy, size: 7, font, color: MUTED })
    fy -= 9
  }

  const bytes = await doc.save()
  return Buffer.from(bytes)
}
