import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { parseReleveCsv } from '@/lib/csv-releve-parser'
import { ensureCompteBancairePrincipal } from '@/lib/compta-compte'
import { dbNotConfiguredResponse, getPrismaOrNull } from '@/lib/db'
import { blobPaths, uploadBlob } from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error }, { status: err.status })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Multipart/form-data attendu' }, { status: 400 })
  }

  const annee = Number(formData.get('periode_annee'))
  const mois = Number(formData.get('periode_mois'))
  if (!Number.isInteger(annee) || annee < 2020 || !Number.isInteger(mois) || mois < 1 || mois > 12) {
    return NextResponse.json({ error: 'Période invalide (periode_annee, periode_mois)' }, { status: 400 })
  }

  const pdf = formData.get('pdf')
  if (!(pdf instanceof File) || pdf.size === 0) {
    return NextResponse.json({ error: 'PDF du relevé requis' }, { status: 400 })
  }
  if (pdf.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'PDF trop lourd (max 15 Mo)' }, { status: 413 })
  }

  const soldeRaw = String(formData.get('solde_fin_mois') || '').trim().replace(',', '.')
  const solde_fin_mois = soldeRaw ? Number(soldeRaw) : null
  const notes = String(formData.get('notes') || '').trim()

  const compteId = await ensureCompteBancairePrincipal()
  const importBatchId = crypto.randomUUID()
  const pdfBuf = Buffer.from(await pdf.arrayBuffer())

  let pdf_url: string
  try {
    pdf_url = await uploadBlob({
      pathname: blobPaths.releve(compteId, annee, mois),
      body: pdfBuf,
      contentType: 'application/pdf',
    })
  } catch (e) {
    return NextResponse.json(
      { error: `Upload Blob : ${e instanceof Error ? e.message : 'erreur'}` },
      { status: 502 },
    )
  }

  let nbOperations = 0
  const parseErrors: string[] = []

  const csv = formData.get('csv')
  if (csv instanceof File && csv.size > 0) {
    const text = await csv.text()
    const { lignes, errors } = parseReleveCsv(text)
    parseErrors.push(...errors)

    if (lignes.length > 0) {
      await prisma.operationBancaire.createMany({
        data: lignes.map(l => ({
          compte_id: compteId,
          date_operation: new Date(l.date_operation),
          date_valeur: l.date_valeur ? new Date(l.date_valeur) : null,
          libelle: l.libelle,
          reference_brute: l.reference_brute,
          debit: l.debit,
          credit: l.credit,
          source_import: 'csv',
          import_batch_id: importBatchId,
        })),
      })
      nbOperations = lignes.length
    }
  }

  const releve = await prisma.releveBancaire.upsert({
    where: {
      compte_id_periode_annee_periode_mois: {
        compte_id: compteId,
        periode_annee: annee,
        periode_mois: mois,
      },
    },
    create: {
      compte_id: compteId,
      periode_annee: annee,
      periode_mois: mois,
      pdf_url,
      fichier_nom: pdf.name,
      import_batch_id: importBatchId,
      nb_operations: nbOperations,
      solde_fin_mois: Number.isFinite(solde_fin_mois) ? solde_fin_mois : null,
      notes: notes || null,
    },
    update: {
      pdf_url,
      fichier_nom: pdf.name,
      import_batch_id: importBatchId,
      nb_operations: nbOperations,
      solde_fin_mois: Number.isFinite(solde_fin_mois) ? solde_fin_mois : null,
      notes: notes || null,
      uploaded_at: new Date(),
    },
    select: { id: true, periode_annee: true, periode_mois: true, pdf_url: true, nb_operations: true },
  })

  return NextResponse.json({
    ok: true,
    releve,
    nb_operations: nbOperations,
    ...(parseErrors.length ? { parse_warnings: parseErrors } : {}),
    ...(nbOperations === 0 && !(csv instanceof File && csv.size > 0)
      ? { info: 'Relevé PDF enregistré. Ajoutez un CSV pour importer les lignes bancaires.' }
      : {}),
  })
}
