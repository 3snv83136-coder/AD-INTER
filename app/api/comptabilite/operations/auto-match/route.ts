import { NextRequest, NextResponse } from 'next/server'
import { resoudreAffectation } from '@/lib/compta-affectation'
import { bornesMois } from '@/lib/compta-kpis'
import { suggererRapprochements } from '@/lib/compta-rapprochement'
import { dbNotConfiguredResponse, getPrismaOrNull } from '@/lib/db'

export const dynamic = 'force-dynamic'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error }, { status: err.status })
  }

  let body: { annee?: number; mois?: number; from?: string; to?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  let dateFrom = body.from || ''
  let dateTo = body.to || ''
  if (body.annee && body.mois) {
    const b = bornesMois(body.annee, body.mois)
    dateFrom = b.from
    dateTo = b.to
  }

  const ops = await prisma.operationBancaire.findMany({
    where: {
      lettre: false,
      ...(dateFrom || dateTo
        ? {
            date_operation: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    select: { id: true, date_operation: true, libelle: true, debit: true, credit: true, lettre: true },
  })

  const [recRows, depRows] = await Promise.all([
    prisma.document.findMany({
      where: {
        type: 'facture',
        statut: { not: 'annule' },
        ...(dateFrom || dateTo
          ? {
              date_emission: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo ? { lte: new Date(dateTo) } : {}),
              },
            }
          : {}),
      },
      select: { id: true, numero: true, date_emission: true, montant_ttc: true, statut: true, client_id: true },
    }),
    prisma.factureFournisseur.findMany({
      where: {
        ...(dateFrom || dateTo
          ? {
              date_facture: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo ? { lte: new Date(dateTo) } : {}),
              },
            }
          : {}),
      },
      select: { id: true, fournisseur: true, date_facture: true, montant_ttc: true, categorie: true },
    }),
  ])

  const depById = Object.fromEntries(depRows.map(d => [d.id, d]))

  const suggestions = suggererRapprochements(
    ops.map(o => ({
      id: o.id,
      date_operation: isoDate(o.date_operation),
      libelle: o.libelle || '',
      debit: Number(o.debit) || 0,
      credit: Number(o.credit) || 0,
      lettre: false,
    })),
    recRows.map(r => ({
      id: r.id,
      numero: r.numero,
      date_emission: isoDate(r.date_emission),
      montant_ttc: r.montant_ttc != null ? Number(r.montant_ttc) : null,
      statut: r.statut || '',
    })),
    depRows.map(d => ({
      id: d.id,
      fournisseur: d.fournisseur || '',
      date_facture: isoDate(d.date_facture),
      montant_ttc: Number(d.montant_ttc) || 0,
    })),
  )

  let matched = 0
  let skipped_no_compte = 0
  const errors: string[] = []
  const needs_manual: string[] = []
  const now = new Date()

  for (const s of suggestions) {
    const op = ops.find(o => o.id === s.operation_id)
    if (!op) continue

    const debit = Number(op.debit) || 0
    const credit = Number(op.credit) || 0
    const document_id = s.type === 'recette' ? s.cible_id : null
    const facture_fournisseur_id = s.type === 'depense' ? s.cible_id : null
    const categorie = facture_fournisseur_id
      ? depById[facture_fournisseur_id]?.categorie ?? null
      : null

    const resolved = resoudreAffectation({
      debit,
      credit,
      document_id,
      facture_fournisseur_id,
      categorie,
    })

    if (!resolved.ok) {
      skipped_no_compte++
      needs_manual.push(s.operation_id)
      continue
    }

    try {
      await prisma.operationBancaire.update({
        where: { id: s.operation_id },
        data: {
          lettre: true,
          lettre_at: now,
          document_id,
          facture_fournisseur_id,
          categorie,
          compte_num: resolved.affectation.compte_num,
          compte_lib: resolved.affectation.compte_lib,
        },
      })
    } catch (e) {
      errors.push(`${s.operation_id}: ${e instanceof Error ? e.message : 'erreur'}`)
      continue
    }

    if (s.type === 'recette') {
      await prisma.document.update({
        where: { id: s.cible_id },
        data: { statut: 'paye' },
      })
    }
    matched++
  }

  return NextResponse.json({
    ok: true,
    matched,
    skipped_no_compte,
    needs_manual,
    suggestions_total: suggestions.length,
    ...(errors.length ? { errors } : {}),
  })
}
