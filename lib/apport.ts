import { Prisma } from "@prisma/client"
import { getPrismaOrNull } from "@/lib/db"
import { FLUX_RAPPORTEUR } from "@/lib/rapporteur"
import { verifyApportToken, type ApportTokenPayload } from "@/lib/apport-token"

export const PHOTO_SLOT_AVANT = "avant"
export const PHOTO_SLOT_APRES = "apres"

export type ApportAffaire = {
  type_intervention: string | null
  date_prevue: string | null
  heure_prevue: string | null
  ville: string | null
  adresse: string
  client_nom: string | null
  client_telephone: string | null
  client_email: string | null
  notes: string | null
  sous_traitant_nom: string
  already: boolean
  photo_avant: string | null
  photo_apres: string | null
}

export type ApportContext = {
  payload: ApportTokenPayload
  interventionId: string
  already: boolean
  pris_en_charge: boolean
  affaire: ApportAffaire
  photos_urls: string[]
  photos_legendes: string[]
  rapport_json: Prisma.JsonValue
}

function fmtHeure(d: Date | null): string | null {
  if (!d) return null
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
}

export function photoUrlForSlot(
  urls: string[],
  legendes: string[],
  slot: string,
): string | null {
  const idx = legendes.findIndex((l) => l === slot)
  if (idx < 0) return null
  return urls[idx] || null
}

export function upsertPhotoSlot(
  urls: string[],
  legendes: string[],
  slot: string,
  url: string,
): { urls: string[]; legendes: string[] } {
  const nextUrls = [...urls]
  const nextLegendes = [...legendes]
  const idx = nextLegendes.findIndex((l) => l === slot)
  if (idx >= 0) {
    nextUrls[idx] = url
    return { urls: nextUrls, legendes: nextLegendes }
  }
  nextUrls.push(url)
  nextLegendes.push(slot)
  return { urls: nextUrls, legendes: nextLegendes }
}

export async function loadApportContext(
  token: string,
): Promise<{ ok: true; ctx: ApportContext } | { ok: false; error: string; status: number }> {
  let raw = token
  try {
    raw = decodeURIComponent(token)
  } catch {
    raw = token
  }
  const payload = await verifyApportToken(raw)
  if (!payload) {
    return { ok: false, error: "Lien invalide ou expiré", status: 401 }
  }
  const prisma = getPrismaOrNull()
  if (!prisma) {
    return { ok: false, error: "Service indisponible", status: 503 }
  }

  const interv = await prisma.intervention.findUnique({
    where: { id: payload.interventionId },
    include: {
      client: { select: { nom: true, telephone: true, email: true } },
      sousTraitant: { select: { id: true, nom: true, notes: true } },
    },
  })
  if (!interv || interv.flux !== FLUX_RAPPORTEUR) {
    return { ok: false, error: "Intervention introuvable", status: 404 }
  }
  if (!interv.sousTraitant || interv.sousTraitant.id !== payload.sousTraitantId) {
    return { ok: false, error: "Lien invalide", status: 403 }
  }

  const photos_urls = interv.photos_urls || []
  const photos_legendes = interv.photos_legendes || []
  const already = Boolean(interv.rapporteur_facture_id) || interv.statut === "terminee"
  const adresse = [interv.adresse_chantier, interv.code_postal, interv.ville].filter(Boolean).join(" ")
  const contrat = await prisma.contratSousTraitance.findUnique({
    where: { intervention_id: interv.id },
    select: { id: true },
  })

  return {
    ok: true,
    ctx: {
      payload,
      interventionId: interv.id,
      already,
      pris_en_charge: Boolean(contrat),
      photos_urls,
      photos_legendes,
      rapport_json: interv.rapport_json,
      affaire: {
        type_intervention: interv.type_intervention,
        date_prevue: interv.date_prevue ? interv.date_prevue.toISOString().slice(0, 10) : null,
        heure_prevue: fmtHeure(interv.heure_prevue),
        ville: interv.ville,
        adresse,
        client_nom: interv.client?.nom || null,
        client_telephone: interv.client?.telephone || null,
        client_email: interv.client?.email || null,
        notes: interv.notes_internes,
        sous_traitant_nom: interv.sousTraitant.nom,
        already,
        photo_avant: photoUrlForSlot(photos_urls, photos_legendes, PHOTO_SLOT_AVANT),
        photo_apres: photoUrlForSlot(photos_urls, photos_legendes, PHOTO_SLOT_APRES),
      },
    },
  }
}

export function parseMontant(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw * 100) / 100
  }
  if (typeof raw !== "string") return null
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".")
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

export function parseMontantOptionnel(raw: unknown): { ok: true; value: number | null } | { ok: false } {
  if (raw == null) return { ok: true, value: null }
  if (typeof raw === "string" && !raw.trim()) return { ok: true, value: null }
  const n = parseMontant(raw)
  if (n == null) return { ok: false }
  return { ok: true, value: n }
}

export function parseOuiNon(raw: unknown): boolean | null {
  if (raw === true || raw === "oui" || raw === "true") return true
  if (raw === false || raw === "non" || raw === "false") return false
  return null
}

export function parseImageDataUrl(raw: unknown): { buf: Buffer; mime: "png" | "jpeg" } | null {
  if (typeof raw !== "string") return null
  const compact = raw.trim().replace(/\s+/g, "")
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(compact)
  if (!m) return null
  const buf = Buffer.from(m[2], "base64")
  if (buf.length < 200 || buf.length > 2 * 1024 * 1024) return null
  return { buf, mime: m[1].toLowerCase() === "png" ? "png" : "jpeg" }
}

export function jsonObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) }
  }
  return {}
}

export type ApportRapportLu = {
  rapport: string
  montant: number | null
  soumis_at: string | null
  garantie: boolean | null
  garantie_motif: string
  devis_rebouchage: number | null
  signature_client: string | null
}

export function readApportRapport(
  rapportJson: Prisma.JsonValue | null | undefined,
): ApportRapportLu | null {
  const apport = jsonObject(rapportJson).apport
  if (!apport || typeof apport !== "object" || Array.isArray(apport)) return null
  const rec = apport as Record<string, unknown>
  const rapport = typeof rec.rapport === "string" ? rec.rapport.trim() : ""
  const montant = parseMontant(rec.montant)
  const soumis_at = typeof rec.soumis_at === "string" ? rec.soumis_at : null
  const garantie = parseOuiNon(rec.garantie)
  const garantie_motif = typeof rec.garantie_motif === "string" ? rec.garantie_motif.trim() : ""
  const devis_rebouchage = parseMontant(rec.devis_rebouchage)
  const signature_client = typeof rec.signature_client === "string" ? rec.signature_client.trim() : ""
  if (!rapport && montant == null && !soumis_at && garantie == null && !signature_client) return null
  return {
    rapport,
    montant,
    soumis_at,
    garantie,
    garantie_motif,
    devis_rebouchage,
    signature_client: signature_client || null,
  }
}
