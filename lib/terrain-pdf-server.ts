import crypto from "crypto"
import { createElement, type ReactElement } from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import type { PrismaClient } from "@prisma/client"
import { RealisationDocument, type RapportData } from "@/components/RealisationPDF"
import { FactureDocument } from "@/components/FacturePDF"
import { alloFactureEmetteur } from "@/lib/emetteur"
import { proxyImageUrlAbsolute } from "@/lib/proxyImageUrl"
import { uploadBlob, blobPaths } from "@/lib/storage"

export type GenerateTerrainPdfsInput = {
  interventionId: string
  baseUrl: string
  clientNom: string
  prisma: PrismaClient
}

export type GenerateTerrainPdfsResult = {
  rapport_url: string
  facture_url: string
  rapport_bytes: number
  facture_bytes: number
}

async function uploadPdf(
  prisma: PrismaClient,
  interventionId: string,
  kind: "rapport" | "facture",
  buf: Buffer,
  factureId?: string,
): Promise<string> {
  if (buf.length < 1000) {
    throw new Error(`PDF ${kind} vide ou corrompu`)
  }
  if (buf.length > 12 * 1024 * 1024) {
    throw new Error(`PDF ${kind} trop lourd (max 12 Mo)`)
  }

  const nonce = crypto.randomBytes(3).toString("hex")
  const filename = `${kind}-${Date.now()}-${nonce}.pdf`

  const url = await uploadBlob({
    pathname: blobPaths.pdf(interventionId, filename),
    body: buf,
    contentType: "application/pdf",
  })

  if (kind === "rapport") {
    await prisma.intervention.update({
      where: { id: interventionId },
      data: { pdf_rapport_url: url },
    })
  } else {
    if (!factureId) throw new Error("Facture introuvable")
    await prisma.document.update({
      where: { id: factureId },
      data: { pdf_url: url },
    })
  }

  return url
}

export async function generateTerrainPdfsOnServer(input: GenerateTerrainPdfsInput): Promise<GenerateTerrainPdfsResult> {
  const { interventionId, baseUrl, clientNom, prisma } = input

  const interv = await prisma.intervention.findUnique({
    where: { id: interventionId },
    select: {
      id: true,
      reference: true,
      type_intervention: true,
      adresse_chantier: true,
      ville: true,
      code_postal: true,
      date_realisee: true,
      date_prevue: true,
      agence: true,
      rapport_json: true,
      photos_urls: true,
      photos_legendes: true,
      pdf_rapport_url: true,
      technicien_id: true,
      client_id: true,
    },
  })

  if (!interv) throw new Error("Intervention introuvable")
  if (!interv.rapport_json || Object.keys(interv.rapport_json as object).length === 0) {
    throw new Error("Rapport non sauvegardé")
  }

  let technicienNom = "Technicien"
  if (interv.technicien_id) {
    const t = await prisma.technicien.findUnique({
      where: { id: interv.technicien_id },
      select: { nom: true },
    })
    if (t?.nom) technicienNom = t.nom
  }

  let clientRow: { adresse?: string | null; code_postal?: string | null; ville?: string | null } | null = null
  if (interv.client_id) {
    clientRow = await prisma.client.findUnique({
      where: { id: interv.client_id },
      select: { adresse: true, code_postal: true, ville: true },
    })
  }

  const facture = await prisma.document.findFirst({
    where: { intervention_id: interventionId, type: "facture" },
    orderBy: { created_at: "desc" },
    select: { id: true, payload: true, pdf_url: true },
  })

  if (!facture?.payload) throw new Error("Facture introuvable")

  const photos = (interv.photos_urls || []).map((url, i) => ({
    url: proxyImageUrlAbsolute(url, baseUrl),
    legende: (interv.photos_legendes || [])[i] || `Photo ${i + 1}`,
  }))

  const dateStr = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "")

  const rapportBuf = await renderToBuffer(
    createElement(RealisationDocument, {
      clientNom,
      adresse: interv.adresse_chantier || "",
      ville: interv.ville || "",
      codePostal: interv.code_postal || "",
      dateIntervention: dateStr(interv.date_realisee) || dateStr(interv.date_prevue),
      typeIntervention: interv.type_intervention || "",
      technicienNom,
      rapport: interv.rapport_json as unknown as RapportData,
      reference: interv.reference || undefined,
      photos,
    }) as ReactElement,
  )

  const adresseLine1 = clientRow?.adresse || interv.adresse_chantier || ""
  const adresseCP = clientRow?.code_postal || interv.code_postal || ""
  const adresseVille = clientRow?.ville || interv.ville || ""
  const clientAdresseLignes: string[] = []
  if (adresseLine1) clientAdresseLignes.push(adresseLine1)
  if (adresseCP || adresseVille) {
    clientAdresseLignes.push([adresseCP, adresseVille].filter(Boolean).join(" "))
  }

  const factureBuf = await renderToBuffer(
    createElement(FactureDocument, {
      emetteur: alloFactureEmetteur(interv.agence || undefined),
      client: {
        nom: clientNom,
        adresseLignes: clientAdresseLignes.length > 0 ? clientAdresseLignes : ["—"],
      },
      facture: facture.payload as unknown as React.ComponentProps<typeof FactureDocument>['facture'],
    }) as ReactElement,
  )

  const rapport_url = await uploadPdf(prisma, interventionId, "rapport", Buffer.from(rapportBuf))
  const facture_url = await uploadPdf(prisma, interventionId, "facture", Buffer.from(factureBuf), facture.id)

  return {
    rapport_url,
    facture_url,
    rapport_bytes: rapportBuf.byteLength,
    facture_bytes: factureBuf.byteLength,
  }
}

export async function terrainPdfsReady(prisma: PrismaClient, interventionId: string): Promise<{
  ready: boolean
  rapport_url: string | null
  facture_url: string | null
}> {
  const interv = await prisma.intervention.findUnique({
    where: { id: interventionId },
    select: { pdf_rapport_url: true },
  })

  const facture = await prisma.document.findFirst({
    where: { intervention_id: interventionId, type: "facture" },
    orderBy: { created_at: "desc" },
    select: { pdf_url: true },
  })

  const rapport_url = interv?.pdf_rapport_url || null
  const facture_url = facture?.pdf_url || null

  return {
    ready: !!(rapport_url && facture_url),
    rapport_url,
    facture_url,
  }
}
