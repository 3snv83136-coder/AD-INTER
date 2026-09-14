import { NextRequest, NextResponse } from "next/server"
import { dbNotConfiguredResponse, getPrismaOrNull } from "@/lib/db"
import { getSessionUser } from "@/lib/intervention-access"
import { OPERATOR_CLIENT_FIELDS, requireFullAdmin } from "@/lib/permissions"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

const UPDATABLE = new Set(['nom', 'email', 'telephone', 'adresse', 'code_postal', 'ville'])

const clientSelect = {
  id: true,
  nom: true,
  email: true,
  telephone: true,
  adresse: true,
  code_postal: true,
  ville: true,
} as const

/** GET /api/clients/[id] — fiche client. */
export async function GET(_req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  try {
    const data = await prisma.client.findUnique({
      where: { id: params.id },
      select: clientSelect,
    })
    if (!data) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    return NextResponse.json({ client: data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur' },
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/clients/[id] — met à jour les champs autorisés d'un client.
 * Body : { nom?, email?, telephone?, adresse?, code_postal?, ville? }
 * Utilisé notamment par le wizard Mode Terrain pour compléter un nom manquant
 * sans quitter le flux d'envoi.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const role = (await getSessionUser())?.role
  const allowed = !role || role === "admin"
    ? UPDATABLE
    : new Set<string>(OPERATOR_CLIENT_FIELDS)

  const update: Record<string, string | null> = {}
  for (const [k, v] of Object.entries(body)) {
    if (!allowed.has(k)) continue
    if (typeof v === 'string') {
      const trimmed = v.trim()
      update[k] = trimmed === '' ? null : trimmed
    } else if (v === null) {
      update[k] = null
    }
  }

  if (typeof update.nom === 'string' && update.nom.length === 0) {
    return NextResponse.json({ error: 'Le nom ne peut pas être vide' }, { status: 400 })
  }
  if ('nom' in update && update.nom === null) {
    return NextResponse.json({ error: 'Le nom ne peut pas être vide' }, { status: 400 })
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  try {
    const data = await prisma.client.update({
      where: { id: params.id },
      data: update,
      select: clientSelect,
    })
    return NextResponse.json({ client: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur'
    if (msg.includes('Record to update not found')) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/clients/[id] — supprime un client.
 * Refuse (409) si le client a des interventions ou documents liés :
 * il faut d'abord les supprimer pour préserver la cohérence de l'historique.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const denied = requireFullAdmin((await getSessionUser())?.role)
  if (denied) return denied
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const id = params.id
  if (!id) return NextResponse.json({ error: 'ID client manquant' }, { status: 400 })

  const [interventions, documents] = await Promise.all([
    prisma.intervention.count({ where: { client_id: id } }),
    prisma.document.count({ where: { client_id: id } }),
  ])

  if (interventions > 0 || documents > 0) {
    const parts: string[] = []
    if (interventions > 0) parts.push(`${interventions} intervention${interventions > 1 ? 's' : ''}`)
    if (documents > 0) parts.push(`${documents} document${documents > 1 ? 's' : ''} (factures/devis)`)
    return NextResponse.json({
      error: `Impossible de supprimer ce client : ${parts.join(' et ')} y ${interventions + documents > 1 ? 'sont' : 'est'} rattaché${interventions + documents > 1 ? 's' : ''}. Supprime-les d'abord.`,
      interventions,
      documents,
    }, { status: 409 })
  }

  try {
    const deleted = await prisma.client.delete({
      where: { id },
      select: { id: true },
    })
    if (!deleted) {
      return NextResponse.json({ error: 'Client introuvable (peut-être déjà supprimé)' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur'
    if (msg.includes('Record to delete does not exist')) {
      return NextResponse.json({ error: 'Client introuvable (peut-être déjà supprimé)' }, { status: 404 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
