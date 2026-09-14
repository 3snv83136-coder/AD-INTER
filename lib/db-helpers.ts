import { Prisma } from '@prisma/client'
import { getPrismaOrNull } from '@/lib/db'
import type { DocumentStatut, DocumentType } from '@/lib/types'

function buildClientPatch(input: {
  nom?: string | null
  email?: string | null
  telephone?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
}): Prisma.ClientUpdateInput {
  const trim = (v: string | null | undefined) => (v || '').trim()
  const patch: Prisma.ClientUpdateInput = {}
  if (trim(input.nom)) patch.nom = trim(input.nom)
  if (trim(input.email)) patch.email = trim(input.email)
  if (trim(input.telephone)) patch.telephone = trim(input.telephone)
  if (trim(input.adresse)) patch.adresse = trim(input.adresse)
  if (trim(input.code_postal)) patch.code_postal = trim(input.code_postal)
  if (trim(input.ville)) patch.ville = trim(input.ville)
  return patch
}

export async function saveDocument(input: {
  type: DocumentType
  numero?: string | null
  agence?: string | null
  date_emission?: string | null
  echeance?: string | null
  statut?: DocumentStatut
  montant_ht?: number | null
  montant_ttc?: number | null
  tva_taux?: number | null
  payload: Prisma.InputJsonValue
  intervention_id?: string | null
  client_id?: string | null
  pdf_url?: string | null
  envoye_email?: string | null
  envoye_at?: string | null
}): Promise<string | null> {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    console.warn('[saveDocument] DATABASE_URL absente — document non persisté')
    return null
  }

  const row = {
    type: input.type,
    numero: input.numero || null,
    agence: input.agence || null,
    date_emission: input.date_emission ? new Date(input.date_emission) : new Date(),
    echeance: input.echeance || null,
    statut: input.statut || 'envoye',
    montant_ht: input.montant_ht ?? null,
    montant_ttc: input.montant_ttc ?? null,
    tva_taux: input.tva_taux ?? null,
    payload: input.payload || {},
    intervention_id: input.intervention_id || null,
    client_id: input.client_id || null,
    pdf_url: input.pdf_url || null,
    envoye_email: input.envoye_email || null,
    envoye_at: input.envoye_at ? new Date(input.envoye_at) : null,
  }

  if (row.numero) {
    const existing = await prisma.document.findFirst({
      where: { type: row.type, numero: row.numero },
      select: { id: true },
    })
    if (existing) {
      await prisma.document.update({ where: { id: existing.id }, data: row })
      return existing.id
    }
  }

  try {
    const created = await prisma.document.create({ data: row, select: { id: true } })
    return created.id
  } catch (e) {
    console.error('[saveDocument:insert]', e)
    return null
  }
}

export async function upsertClient(input: {
  nom?: string | null
  email?: string | null
  telephone?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
}): Promise<string | null> {
  const prisma = getPrismaOrNull()
  if (!prisma) return null
  const nom = (input.nom || '').trim()
  if (!nom) return null

  let existingId: string | null = null
  if (input.email) {
    const existing = await prisma.client.findFirst({
      where: { email: input.email },
      select: { id: true },
    })
    if (existing) existingId = existing.id
  }
  if (!existingId) {
    const existing = await prisma.client.findFirst({
      where: { nom, ville: input.ville || '' },
      select: { id: true },
    })
    if (existing) existingId = existing.id
  }

  if (existingId) {
    const patch = buildClientPatch(input)
    if (Object.keys(patch).length > 0) {
      try {
        await prisma.client.update({ where: { id: existingId }, data: patch })
      } catch (e) {
        console.error('[upsertClient update]', e)
      }
    }
    return existingId
  }

  try {
    const created = await prisma.client.create({
      data: {
        nom,
        email: input.email || null,
        telephone: input.telephone || null,
        adresse: input.adresse || null,
        code_postal: input.code_postal || null,
        ville: input.ville || null,
      },
      select: { id: true },
    })
    return created.id
  } catch (e) {
    console.error('[upsertClient]', e)
    return null
  }
}

export async function patchClient(
  id: string,
  input: {
    nom?: string | null
    email?: string | null
    telephone?: string | null
    adresse?: string | null
    code_postal?: string | null
    ville?: string | null
  },
): Promise<void> {
  const prisma = getPrismaOrNull()
  if (!prisma || !id) return
  const patch = buildClientPatch(input)
  if (Object.keys(patch).length === 0) return
  try {
    await prisma.client.update({ where: { id }, data: patch })
  } catch (e) {
    console.error('[patchClient]', e)
  }
}
