import { NextRequest, NextResponse } from 'next/server'
import { dbNotConfiguredResponse, getPrismaOrNull } from '@/lib/db'
import type { FactureFournisseur } from '@/lib/types'

export const dynamic = 'force-dynamic'

const CATEGORIES_VALIDES = [
  'carburant', 'materiel', 'sous_traitance', 'assurance',
  'telecom', 'locaux', 'autre',
] as const

type Categorie = typeof CATEGORIES_VALIDES[number]

function toNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function isCategorieValide(v: unknown): v is Categorie {
  return typeof v === 'string' && (CATEGORIES_VALIDES as readonly string[]).includes(v)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function serializeFacture(row: FactureFournisseur) {
  return {
    id: row.id,
    fournisseur: row.fournisseur,
    numero: row.numero,
    date_facture: isoDate(row.date_facture),
    montant_ht: Number(row.montant_ht),
    tva: Number(row.tva),
    montant_ttc: Number(row.montant_ttc),
    categorie: row.categorie,
    description: row.description,
    pdf_url: row.pdf_url,
    agence: row.agence,
    created_at: row.created_at.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error, factures: [] }, { status: err.status })
  }

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const categorie = url.searchParams.get('categorie')
  const agence = url.searchParams.get('agence')

  const data = await prisma.factureFournisseur.findMany({
    where: {
      ...(from || to
        ? {
            date_facture: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(categorie ? { categorie } : {}),
      ...(agence ? { agence } : {}),
    },
    orderBy: { date_facture: 'desc' },
  })

  return NextResponse.json({ factures: data.map(serializeFacture) })
}

export async function POST(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error }, { status: err.status })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const fournisseur = typeof body.fournisseur === 'string' ? body.fournisseur.trim() : ''
  const date_facture = typeof body.date_facture === 'string' ? body.date_facture.trim() : ''
  if (!fournisseur) {
    return NextResponse.json({ error: 'Le champ "fournisseur" est requis.' }, { status: 400 })
  }
  if (!date_facture || !/^\d{4}-\d{2}-\d{2}$/.test(date_facture)) {
    return NextResponse.json({ error: 'Le champ "date_facture" est requis (format YYYY-MM-DD).' }, { status: 400 })
  }

  const montant_ht = toNum(body.montant_ht, 0)
  const tva = toNum(body.tva, 0)
  let montant_ttc = toNum(body.montant_ttc, 0)
  if (!montant_ttc) montant_ttc = montant_ht + tva

  const categorie = isCategorieValide(body.categorie) ? body.categorie : null

  const data = await prisma.factureFournisseur.create({
    data: {
      fournisseur,
      numero: typeof body.numero === 'string' && body.numero.trim() ? body.numero.trim() : null,
      date_facture: new Date(date_facture),
      montant_ht,
      tva,
      montant_ttc,
      categorie,
      description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null,
      pdf_url: typeof body.pdf_url === 'string' && body.pdf_url.trim() ? body.pdf_url.trim() : null,
      agence: typeof body.agence === 'string' && body.agence.trim() ? body.agence.trim() : null,
    },
  })

  return NextResponse.json({ facture: serializeFacture(data) })
}
