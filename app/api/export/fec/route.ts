import { NextRequest, NextResponse } from 'next/server'
import { dbNotConfiguredResponse, getPrismaOrNull } from '@/lib/db'

export const dynamic = 'force-dynamic'

const TAB = '\t'
const EOL = '\r\n'

const FEC_HEADERS = [
  'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
  'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
  'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
  'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise',
] as const

const COMPTES_CHARGES: Record<string, { num: string; lib: string }> = {
  carburant:      { num: '60611', lib: 'Carburants' },
  materiel:       { num: '60630', lib: 'Petit matériel' },
  sous_traitance: { num: '6041',  lib: 'Sous-traitance' },
  assurance:      { num: '6160',  lib: 'Assurances' },
  telecom:        { num: '6260',  lib: 'Télécommunications' },
  locaux:         { num: '6132',  lib: 'Locations immobilières' },
  autre:          { num: '6068',  lib: 'Autres charges' },
}

function fmtMontant(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return v.toFixed(2).replace('.', ',')
}

function fmtDateYYYYMMDD(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[1]}${m[2]}${m[3]}` : ''
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function safe(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/[\t\r\n]+/g, ' ').trim()
}

function fecLine(cells: (string | number)[]): string {
  return cells.map(c => typeof c === 'number' ? String(c) : c).join(TAB)
}

function compAuxNum(id: string | null | undefined): string {
  if (!id) return ''
  return id.replace(/-/g, '').slice(0, 12).toUpperCase()
}

export async function GET(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error }, { status: err.status })
  }

  const url = new URL(req.url)
  const from = url.searchParams.get('from') || ''
  const to = url.searchParams.get('to') || ''

  const [ventes, achats] = await Promise.all([
    prisma.document.findMany({
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
      orderBy: { date_emission: 'asc' },
    }),
    prisma.factureFournisseur.findMany({
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
        agence: true,
      },
      orderBy: { date_facture: 'asc' },
    }),
  ])

  const clientIds = Array.from(new Set(ventes.map(v => v.client_id).filter((x): x is string => !!x)))
  let clientsMap: Record<string, string> = {}
  if (clientIds.length > 0) {
    const cls = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, nom: true },
    })
    clientsMap = Object.fromEntries(cls.map(c => [c.id, c.nom || '']))
  }

  let body = FEC_HEADERS.join(TAB) + EOL

  let numVE = 0
  for (const v of ventes) {
    numVE += 1
    const ht = v.montant_ht != null ? Number(v.montant_ht) : 0
    const ttc = v.montant_ttc != null ? Number(v.montant_ttc) : 0
    const tva = Math.max(0, ttc - ht)
    const dateY = fmtDateYYYYMMDD(isoDate(v.date_emission))
    const clientNom = v.client_id ? (clientsMap[v.client_id] || '') : ''
    const lib = safe(`Facture ${clientNom} ${v.numero || ''}`.trim())
    const pieceRef = safe(v.numero || v.id)
    const auxNum = compAuxNum(v.client_id)
    const auxLib = safe(clientNom)

    body += fecLine([
      'VE', 'Journal des ventes', numVE, dateY,
      '411', 'Clients', auxNum, auxLib,
      pieceRef, dateY, lib, fmtMontant(ttc), fmtMontant(0),
      '', '', '', fmtMontant(0), '',
    ]) + EOL

    body += fecLine([
      'VE', 'Journal des ventes', numVE, dateY,
      '706', 'Prestations de services', '', '',
      pieceRef, dateY, lib, fmtMontant(0), fmtMontant(ht),
      '', '', '', fmtMontant(0), '',
    ]) + EOL

    if (tva > 0) {
      body += fecLine([
        'VE', 'Journal des ventes', numVE, dateY,
        '44571', 'TVA collectée', '', '',
        pieceRef, dateY, lib, fmtMontant(0), fmtMontant(tva),
        '', '', '', fmtMontant(0), '',
      ]) + EOL
    }
  }

  let numAC = 0
  for (const a of achats) {
    numAC += 1
    const ht = a.montant_ht != null ? Number(a.montant_ht) : 0
    const tva = a.tva != null ? Number(a.tva) : 0
    const ttc = a.montant_ttc != null ? Number(a.montant_ttc) : (ht + tva)
    const dateY = fmtDateYYYYMMDD(isoDate(a.date_facture))
    const cat = a.categorie || 'autre'
    const compte = COMPTES_CHARGES[cat] || COMPTES_CHARGES.autre
    const lib = safe(`Facture ${a.fournisseur || ''} ${a.numero || ''}`.trim())
    const pieceRef = safe(a.numero || a.id)
    const auxNum = compAuxNum(a.id)
    const auxLib = safe(a.fournisseur || '')

    body += fecLine([
      'AC', 'Journal des achats', numAC, dateY,
      compte.num, compte.lib, '', '',
      pieceRef, dateY, lib, fmtMontant(ht), fmtMontant(0),
      '', '', '', fmtMontant(0), '',
    ]) + EOL

    if (tva > 0) {
      body += fecLine([
        'AC', 'Journal des achats', numAC, dateY,
        '44566', 'TVA déductible', '', '',
        pieceRef, dateY, lib, fmtMontant(tva), fmtMontant(0),
        '', '', '', fmtMontant(0), '',
      ]) + EOL
    }

    body += fecLine([
      'AC', 'Journal des achats', numAC, dateY,
      '401', 'Fournisseurs', auxNum, auxLib,
      pieceRef, dateY, lib, fmtMontant(0), fmtMontant(ttc),
      '', '', '', fmtMontant(0), '',
    ]) + EOL
  }

  const SIREN = process.env.ALLO_SIREN || ''
  const dateFin = (to || from || new Date().toISOString().slice(0, 10)).replace(/-/g, '')
  const filename = `${SIREN}FEC${dateFin}.txt`

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
