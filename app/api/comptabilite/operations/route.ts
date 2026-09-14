import { NextRequest, NextResponse } from 'next/server'
import { bornesMois } from '@/lib/compta-kpis'
import { suggererRapprochements } from '@/lib/compta-rapprochement'
import { dbNotConfiguredResponse, getPrismaOrNull } from '@/lib/db'

export const dynamic = 'force-dynamic'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error }, { status: err.status })
  }

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const annee = url.searchParams.get('annee')
  const mois = url.searchParams.get('mois')
  const lettreOnly = url.searchParams.get('lettre') === 'true'
  const nonLettreOnly = url.searchParams.get('non_lettre') === 'true'

  let dateFrom = from || ''
  let dateTo = to || ''
  if (annee && mois) {
    const b = bornesMois(Number(annee), Number(mois))
    dateFrom = b.from
    dateTo = b.to
  }

  const pourAffectation = url.searchParams.get('pour_affectation') === '1'

  const operations = await prisma.operationBancaire.findMany({
    where: {
      ...(dateFrom || dateTo
        ? {
            date_operation: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
      ...(lettreOnly ? { lettre: true } : {}),
      ...(nonLettreOnly ? { lettre: false } : {}),
    },
    select: {
      id: true,
      compte_id: true,
      date_operation: true,
      date_valeur: true,
      libelle: true,
      debit: true,
      credit: true,
      lettre: true,
      lettre_at: true,
      document_id: true,
      facture_fournisseur_id: true,
      categorie: true,
      compte_num: true,
      compte_lib: true,
      import_batch_id: true,
    },
    orderBy: { date_operation: 'desc' },
    take: 500,
  })

  const ops = operations.map(o => ({
    id: o.id,
    compte_id: o.compte_id,
    date_operation: isoDate(o.date_operation),
    date_valeur: o.date_valeur ? isoDate(o.date_valeur) : null,
    libelle: o.libelle,
    debit: Number(o.debit) || 0,
    credit: Number(o.credit) || 0,
    lettre: o.lettre,
    lettre_at: o.lettre_at?.toISOString() ?? null,
    document_id: o.document_id,
    facture_fournisseur_id: o.facture_fournisseur_id,
    categorie: o.categorie,
    compte_num: o.compte_num,
    compte_lib: o.compte_lib,
    import_batch_id: o.import_batch_id,
  }))

  const recetteWhere: {
    type: 'facture'
    statut: { not: 'annule' } | { in: string[] }
    date_emission?: { gte?: Date; lte?: Date }
  } = { type: 'facture', statut: { not: 'annule' } }

  const depenseWhere: {
    date_facture?: { gte?: Date; lte?: Date }
  } = {}

  if (pourAffectation) {
    const depuis = new Date()
    depuis.setMonth(depuis.getMonth() - 12)
    const depuisStr = depuis.toISOString().slice(0, 10)
    recetteWhere.statut = { in: ['envoye', 'brouillon', 'paye'] }
    recetteWhere.date_emission = { gte: new Date(depuisStr) }
    depenseWhere.date_facture = { gte: new Date(depuisStr) }
  } else {
    if (dateFrom) {
      recetteWhere.date_emission = { ...recetteWhere.date_emission, gte: new Date(dateFrom) }
      depenseWhere.date_facture = { ...depenseWhere.date_facture, gte: new Date(dateFrom) }
    }
    if (dateTo) {
      recetteWhere.date_emission = { ...recetteWhere.date_emission, lte: new Date(dateTo) }
      depenseWhere.date_facture = { ...depenseWhere.date_facture, lte: new Date(dateTo) }
    }
  }

  const [recRows, depRows] = await Promise.all([
    prisma.document.findMany({
      where: recetteWhere,
      select: { id: true, numero: true, date_emission: true, montant_ttc: true, statut: true, client_id: true },
    }),
    prisma.factureFournisseur.findMany({
      where: depenseWhere,
      select: { id: true, fournisseur: true, numero: true, date_facture: true, montant_ttc: true, categorie: true },
    }),
  ])

  const clientIds = Array.from(new Set(recRows.map(r => r.client_id).filter((v): v is string => !!v)))
  let clientsMap: Record<string, string> = {}
  if (clientIds.length > 0) {
    const cls = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, nom: true },
    })
    clientsMap = Object.fromEntries(cls.map(c => [c.id, c.nom || '']))
  }

  const recettes = recRows.map(r => ({
    id: r.id,
    numero: r.numero,
    date_emission: isoDate(r.date_emission),
    montant_ttc: r.montant_ttc != null ? Number(r.montant_ttc) : null,
    statut: r.statut || '',
    client_nom: r.client_id ? clientsMap[r.client_id] || null : null,
  }))

  const depenses = depRows.map(d => ({
    id: d.id,
    fournisseur: d.fournisseur || '',
    numero: d.numero,
    date_facture: isoDate(d.date_facture),
    montant_ttc: Number(d.montant_ttc) || 0,
    categorie: d.categorie,
  }))

  const suggestions = suggererRapprochements(
    ops.map(o => ({
      id: o.id,
      date_operation: o.date_operation,
      libelle: o.libelle || '',
      debit: o.debit,
      credit: o.credit,
      lettre: !!o.lettre,
    })),
    recettes,
    depenses,
  )

  const lettrees = ops.filter(o => o.lettre).length
  const total = ops.length

  return NextResponse.json({
    operations: ops,
    recettes,
    depenses,
    suggestions,
    stats: {
      total,
      lettrees,
      non_lettrees: total - lettrees,
      taux_rapprochement: total > 0 ? Math.round((lettrees / total) * 1000) / 10 : 0,
    },
  })
}
