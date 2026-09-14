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

export async function PUT(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error }, { status: err.status })
  }

  const id = ctx.params.id
  if (!id) {
    return NextResponse.json({ error: 'id manquant' }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const update: {
    fournisseur?: string
    numero?: string | null
    date_facture?: Date
    montant_ht?: number
    tva?: number
    montant_ttc?: number
    categorie?: string | null
    description?: string | null
    pdf_url?: string | null
    agence?: string | null
  } = {}

  if (typeof body.fournisseur === 'string') {
    const v = body.fournisseur.trim()
    if (!v) return NextResponse.json({ error: 'fournisseur requis' }, { status: 400 })
    update.fournisseur = v
  }
  if (typeof body.numero === 'string') update.numero = body.numero.trim() || null
  if (typeof body.date_facture === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date_facture)) {
      return NextResponse.json({ error: 'date_facture invalide (YYYY-MM-DD)' }, { status: 400 })
    }
    update.date_facture = new Date(body.date_facture)
  }
  if (body.montant_ht !== undefined) update.montant_ht = toNum(body.montant_ht, 0)
  if (body.tva !== undefined) update.tva = toNum(body.tva, 0)
  if (body.montant_ttc !== undefined) update.montant_ttc = toNum(body.montant_ttc, 0)
  if (body.categorie !== undefined) {
    update.categorie = isCategorieValide(body.categorie) ? body.categorie : null
  }
  if (typeof body.description === 'string') update.description = body.description.trim() || null
  if (typeof body.pdf_url === 'string') update.pdf_url = body.pdf_url.trim() || null
  if (typeof body.agence === 'string') update.agence = body.agence.trim() || null

  const data = await prisma.factureFournisseur.update({
    where: { id },
    data: update,
  })

  return NextResponse.json({ facture: serializeFacture(data) })
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error }, { status: err.status })
  }

  const id = ctx.params.id
  if (!id) {
    return NextResponse.json({ error: 'id manquant' }, { status: 400 })
  }

  await prisma.factureFournisseur.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
