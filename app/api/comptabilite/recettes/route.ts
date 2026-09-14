import { NextRequest, NextResponse } from 'next/server'
import { dbNotConfiguredResponse, getPrismaOrNull } from '@/lib/db'

export const dynamic = 'force-dynamic'

export type RecetteRow = {
  id: string
  numero: string | null
  date_emission: string
  statut: string
  montant_ht: number | null
  montant_ttc: number | null
  tva_taux: number | null
  agence: string | null
  client_id: string | null
  client_nom: string | null
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error, recettes: [] }, { status: err.status })
  }

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const agence = url.searchParams.get('agence')
  const statut = url.searchParams.get('statut')

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
      ...(agence ? { agence } : {}),
      ...(statut ? { statut } : {}),
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

  const recettes: RecetteRow[] = rows.map(r => ({
    id: r.id,
    numero: r.numero,
    date_emission: isoDate(r.date_emission),
    statut: r.statut || '',
    montant_ht: r.montant_ht != null ? Number(r.montant_ht) : null,
    montant_ttc: r.montant_ttc != null ? Number(r.montant_ttc) : null,
    tva_taux: r.tva_taux != null ? Number(r.tva_taux) : null,
    agence: r.agence,
    client_id: r.client_id,
    client_nom: r.client_id ? clientsMap[r.client_id] || null : null,
  }))

  return NextResponse.json({ recettes })
}
