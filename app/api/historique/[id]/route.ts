import { NextRequest, NextResponse } from "next/server"
import { dbNotConfiguredResponse, getPrismaOrNull } from "@/lib/db"
import type { DocumentStatut } from "@/lib/types"
import { cascadeDeleteDocument } from "@/lib/cascadeDelete"
import { annulerRelancesFacture } from "@/lib/facture-relance"
import { getSessionUser } from "@/lib/intervention-access"
import { canEditDevis, requireFullAdmin } from "@/lib/permissions"
import { FLUX_RAPPORTEUR } from "@/lib/rapporteur"

export const dynamic = 'force-dynamic'

const ALLOWED_STATUTS: DocumentStatut[] = [
  'brouillon', 'envoye', 'paye', 'annule', 'accepte', 'refuse', 'expire',
]

export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }
  const id = ctx.params.id
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  try {
    const data = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        numero: true,
        agence: true,
        date_emission: true,
        echeance: true,
        statut: true,
        montant_ht: true,
        montant_ttc: true,
        tva_taux: true,
        payload: true,
        pdf_url: true,
        envoye_email: true,
        envoye_at: true,
        intervention_id: true,
        client_id: true,
        created_at: true,
      },
    })
    if (!data) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

    let client_nom: string | null = null
    let client_email: string | null = null
    let client_adresse: string | null = null
    let client_code_postal: string | null = null
    let client_ville: string | null = null
    if (data.client_id) {
      const c = await prisma.client.findUnique({
        where: { id: data.client_id },
        select: { nom: true, email: true, adresse: true, code_postal: true, ville: true },
      })
      if (c) {
        client_nom = c.nom || null
        client_email = c.email || null
        client_adresse = c.adresse || null
        client_code_postal = c.code_postal || null
        client_ville = c.ville || null
      }
    }

    return NextResponse.json({
      document: {
        ...data,
        date_emission: data.date_emission.toISOString().slice(0, 10),
        montant_ht: data.montant_ht != null ? Number(data.montant_ht) : null,
        montant_ttc: data.montant_ttc != null ? Number(data.montant_ttc) : null,
        tva_taux: data.tva_taux != null ? Number(data.tva_taux) : null,
        envoye_at: data.envoye_at?.toISOString() ?? null,
        created_at: data.created_at.toISOString(),
        client_nom,
        client_email,
        client_adresse,
        client_code_postal,
        client_ville,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur de chargement' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const denied = requireFullAdmin((await getSessionUser())?.role)
  if (denied) return denied
  const id = ctx.params.id
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  const prisma = getPrismaOrNull()
  if (prisma) {
    const doc = await prisma.document.findUnique({
      where: { id },
      select: { intervention_id: true },
    })
    if (doc?.intervention_id) {
      const interv = await prisma.intervention.findUnique({
        where: { id: doc.intervention_id },
        select: { flux: true },
      })
      if (interv?.flux === FLUX_RAPPORTEUR) {
        return NextResponse.json(
          { error: 'Une affaire rapporteur ne peut pas être supprimée. Tu peux la modifier pour changer le sous-traitant.' },
          { status: 409 },
        )
      }
    }
  }

  const result = await cascadeDeleteDocument(id)

  if (result.kind === 'intervention') {
    if (!result.result.ok) {
      return NextResponse.json({
        error: 'Échec suppression en cascade',
        warnings: result.result.warnings,
      }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      cascade: 'intervention',
      intervention_id: result.result.intervention_id,
      deleted_documents: result.result.deleted_documents,
      deleted_photos: result.result.deleted_photos,
      deleted_pdfs: result.result.deleted_pdfs,
      warnings: result.result.warnings,
    })
  }

  if (!result.ok) {
    const isNotFound = result.warnings.some(w => w.includes('introuvable'))
    return NextResponse.json({
      error: result.warnings.join('; ') || 'Suppression échouée',
    }, { status: isNotFound ? 404 : 500 })
  }
  return NextResponse.json({ ok: true, cascade: 'document', warnings: result.warnings })
}

/**
 * Mise à jour partielle d'un document — typiquement le statut (paye, annule, envoye…).
 * Body attendu : { statut?: DocumentStatut, envoye_at?: string|null, envoye_email?: string|null }
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const id = ctx.params.id
  if (!id) {
    return NextResponse.json({ error: 'id manquant' }, { status: 400 })
  }

  const role = (await getSessionUser())?.role
  if (role === "operateur" || role === "tech") {
    const current = await prisma.document.findUnique({
      where: { id },
      select: { type: true },
    })
    if (!current) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
    if (current.type !== "devis" || !canEditDevis(role)) {
      return NextResponse.json(
        { error: "Cette action est réservée à l’administrateur." },
        { status: 403 },
      )
    }
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const update: {
    statut?: string
    envoye_at?: Date | null
    envoye_email?: string | null
  } = {}
  if (typeof body.statut === 'string') {
    if (!ALLOWED_STATUTS.includes(body.statut as DocumentStatut)) {
      return NextResponse.json({ error: `Statut invalide. Attendus : ${ALLOWED_STATUTS.join(', ')}` }, { status: 400 })
    }
    update.statut = body.statut
  }
  if ('envoye_at' in body) {
    update.envoye_at = body.envoye_at ? new Date(String(body.envoye_at)) : null
  }
  if ('envoye_email' in body) {
    update.envoye_email = body.envoye_email ? String(body.envoye_email) : null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  if (update.statut === 'paye' || update.statut === 'annule') {
    try {
      await annulerRelancesFacture(id)
    } catch (e) {
      console.error('[historique PATCH] annuler relances facture', e)
    }
  }

  try {
    const data = await prisma.document.update({
      where: { id },
      data: update,
      select: { id: true, statut: true, envoye_at: true, envoye_email: true },
    })
    return NextResponse.json({
      ok: true,
      document: {
        ...data,
        envoye_at: data.envoye_at?.toISOString() ?? null,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Mise à jour échouée' },
      { status: 500 },
    )
  }
}
