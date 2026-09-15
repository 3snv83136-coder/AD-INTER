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
      client: { select: { nom: true, telephone: true } },
      sousTraitant: { select: { id: true, nom: true } },
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

  return {
    ok: true,
    ctx: {
      payload,
      interventionId: interv.id,
      already,
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

export function jsonObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) }
  }
  return {}
}
