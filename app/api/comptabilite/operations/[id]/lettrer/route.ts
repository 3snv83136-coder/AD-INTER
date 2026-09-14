import { NextRequest, NextResponse } from 'next/server'
import { libelleEcriture, resoudreAffectation } from '@/lib/compta-affectation'
import { dbNotConfiguredResponse, getPrismaOrNull } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error }, { status: err.status })
  }

  const operationId = params.id
  if (!operationId) return NextResponse.json({ error: 'ID opération manquant' }, { status: 400 })

  const opRow = await prisma.operationBancaire.findUnique({
    where: { id: operationId },
    select: { id: true, debit: true, credit: true },
  })

  if (!opRow) {
    return NextResponse.json({ error: 'Opération introuvable' }, { status: 404 })
  }

  let body: {
    document_id?: string | null
    facture_fournisseur_id?: string | null
    lettre?: boolean
    categorie?: string | null
    compte_num?: string | null
    compte_lib?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const lettre = body.lettre !== false
  const now = new Date()
  const debit = Number(opRow.debit) || 0
  const credit = Number(opRow.credit) || 0

  let categorie = body.categorie ?? null
  if (body.facture_fournisseur_id) {
    const ff = await prisma.factureFournisseur.findUnique({
      where: { id: body.facture_fournisseur_id },
      select: { categorie: true },
    })
    if (!categorie && ff?.categorie) categorie = ff.categorie
  }

  const patch: {
    lettre: boolean
    lettre_at: Date | null
    document_id?: string | null
    facture_fournisseur_id?: string | null
    categorie?: string | null
    compte_num?: string | null
    compte_lib?: string | null
  } = {
    lettre,
    lettre_at: lettre ? now : null,
  }

  if (body.document_id !== undefined) patch.document_id = body.document_id
  if (body.facture_fournisseur_id !== undefined) patch.facture_fournisseur_id = body.facture_fournisseur_id
  if (categorie !== undefined) patch.categorie = categorie

  if (!lettre) {
    patch.document_id = null
    patch.facture_fournisseur_id = null
    patch.compte_num = null
    patch.compte_lib = null
    patch.categorie = null
  } else {
    const resolved = resoudreAffectation({
      debit,
      credit,
      document_id: body.document_id,
      facture_fournisseur_id: body.facture_fournisseur_id,
      categorie,
      compte_num: body.compte_num,
      compte_lib: body.compte_lib,
    })

    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error, needs_compte: resolved.needs_compte },
        { status: 400 },
      )
    }

    patch.compte_num = resolved.affectation.compte_num
    patch.compte_lib = resolved.affectation.compte_lib
  }

  const data = await prisma.operationBancaire.update({
    where: { id: operationId },
    data: patch,
    select: {
      id: true,
      lettre: true,
      document_id: true,
      facture_fournisseur_id: true,
      compte_num: true,
      compte_lib: true,
      categorie: true,
    },
  })

  if (lettre && body.document_id) {
    await prisma.document.update({
      where: { id: body.document_id },
      data: { statut: 'paye' },
    })
  }

  const montant = credit > 0 ? credit : debit
  const ecriture = lettre && data.compte_num
    ? libelleEcriture(
        {
          compte_num: data.compte_num,
          compte_lib: data.compte_lib || '',
          compte_contrepartie: { num: data.compte_num, lib: data.compte_lib || '', groupe: 'autre' },
          sens: credit > 0 ? 'encaissement' : 'decaissement',
        },
        montant,
      )
    : null

  return NextResponse.json({ ok: true, operation: data, ecriture })
}
