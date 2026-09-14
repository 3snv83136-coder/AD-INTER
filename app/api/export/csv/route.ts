import { NextRequest, NextResponse } from 'next/server'
import { dbNotConfiguredResponse, getPrismaOrNull } from '@/lib/db'

export const dynamic = 'force-dynamic'

const SEP = ';'

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = typeof value === 'string' ? value : String(value)
  s = s.replace(/\r?\n/g, ' ')
  if (s.includes(SEP) || s.includes('"') || s.includes('\n')) {
    s = '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function csvLine(cells: unknown[]): string {
  return cells.map(csvCell).join(SEP)
}

function fmtMontant(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return ''
  return n.toFixed(2).replace('.', ',')
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function buildFilename(type: string, from: string | null, to: string | null): string {
  const f = from || ''
  const t = to || ''
  return `allo-${type}-${f}_${t}.csv`.replace(/_+\.csv$/, '.csv')
}

export async function GET(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error }, { status: err.status })
  }

  const url = new URL(req.url)
  const type = url.searchParams.get('type')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  if (type !== 'recettes' && type !== 'depenses') {
    return NextResponse.json({ error: 'type doit être "recettes" ou "depenses"' }, { status: 400 })
  }

  const BOM = '﻿'
  let csv = BOM
  const filename = buildFilename(type, from, to)

  if (type === 'recettes') {
    const rows = await prisma.document.findMany({
      where: {
        type: 'facture',
        ...(from || to
          ? {
              date_emission: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      select: {
        id: true,
        numero: true,
        date_emission: true,
        statut: true,
        montant_ht: true,
        montant_ttc: true,
        tva_taux: true,
        agence: true,
        client_id: true,
      },
      orderBy: { date_emission: 'desc' },
    })

    const clientIds = Array.from(new Set(rows.map(r => r.client_id).filter((v): v is string => !!v)))
    let clientsMap: Record<string, string> = {}
    if (clientIds.length > 0) {
      const cls = await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, nom: true },
      })
      clientsMap = Object.fromEntries(cls.map(c => [c.id, c.nom || '']))
    }

    csv += csvLine(['Date', 'N°', 'Client', 'Agence', 'HT', 'TVA', 'TTC', 'Statut']) + '\r\n'
    for (const r of rows) {
      const ht = r.montant_ht != null ? Number(r.montant_ht) : 0
      const ttc = r.montant_ttc != null ? Number(r.montant_ttc) : 0
      const tva = ttc - ht
      csv += csvLine([
        fmtDate(isoDate(r.date_emission)),
        r.numero || '',
        r.client_id ? (clientsMap[r.client_id] || '') : '',
        r.agence || '',
        fmtMontant(ht),
        fmtMontant(tva),
        fmtMontant(ttc),
        r.statut || '',
      ]) + '\r\n'
    }
  } else {
    const rows = await prisma.factureFournisseur.findMany({
      where: {
        ...(from || to
          ? {
              date_facture: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      select: {
        id: true,
        fournisseur: true,
        numero: true,
        date_facture: true,
        montant_ht: true,
        tva: true,
        montant_ttc: true,
        categorie: true,
        description: true,
        agence: true,
      },
      orderBy: { date_facture: 'desc' },
    })

    csv += csvLine(['Date', 'Fournisseur', 'N°', 'Catégorie', 'HT', 'TVA', 'TTC', 'Agence', 'Description']) + '\r\n'
    for (const r of rows) {
      csv += csvLine([
        fmtDate(isoDate(r.date_facture)),
        r.fournisseur || '',
        r.numero || '',
        r.categorie || '',
        fmtMontant(Number(r.montant_ht)),
        fmtMontant(Number(r.tva)),
        fmtMontant(Number(r.montant_ttc)),
        r.agence || '',
        r.description || '',
      ]) + '\r\n'
    }
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
