import { NextRequest, NextResponse } from 'next/server'
import { dbNotConfiguredResponse, getPrismaOrNull } from '@/lib/db'
import { deleteBlobs } from '@/lib/storage'
import { getSessionUser } from "@/lib/intervention-access"
import { requireFullAdmin } from "@/lib/permissions"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const denied = requireFullAdmin((await getSessionUser())?.role)
  if (denied) return denied
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error }, { status: err.status })
  }

  const id = params.id?.trim()
  if (!id) return NextResponse.json({ error: 'ID relevé manquant' }, { status: 400 })

  const releve = await prisma.releveBancaire.findUnique({
    where: { id },
    select: { id: true, import_batch_id: true, pdf_url: true, periode_annee: true, periode_mois: true },
  })

  if (!releve) return NextResponse.json({ error: 'Relevé introuvable' }, { status: 404 })

  let opsDeleted = 0
  if (releve.import_batch_id) {
    const result = await prisma.operationBancaire.deleteMany({
      where: { import_batch_id: releve.import_batch_id },
    })
    opsDeleted = result.count
  }

  await prisma.preBilan.updateMany({
    where: { releve_id: id },
    data: { releve_id: null },
  })

  if (releve.pdf_url) {
    try {
      await deleteBlobs([releve.pdf_url])
    } catch {
      /* best-effort */
    }
  }

  await prisma.releveBancaire.delete({ where: { id } })

  return NextResponse.json({
    ok: true,
    deleted_id: id,
    operations_deleted: opsDeleted,
    periode: `${releve.periode_annee}-${String(releve.periode_mois).padStart(2, '0')}`,
  })
}
