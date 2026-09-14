import { getPrismaOrNull } from '@/lib/db'
import { blobPaths, deleteBlobs, listBlobPrefix } from '@/lib/storage'

export type CascadeDeleteResult = {
  ok: boolean
  intervention_id: string
  deleted_documents: number
  deleted_photos: number
  deleted_pdfs: number
  warnings: string[]
}

async function emptyBlobPrefix(prefix: string): Promise<{ count: number; warning?: string }> {
  try {
    const { blobs } = await listBlobPrefix(prefix)
    if (!blobs.length) return { count: 0 }
    await deleteBlobs(blobs.map(b => b.url))
    return { count: blobs.length }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { count: 0, warning: `blob ${prefix}: ${msg}` }
  }
}

export async function cascadeDeleteIntervention(interventionId: string): Promise<CascadeDeleteResult> {
  const warnings: string[] = []
  const prisma = getPrismaOrNull()
  if (!prisma) {
    return {
      ok: false, intervention_id: interventionId,
      deleted_documents: 0, deleted_photos: 0, deleted_pdfs: 0,
      warnings: ['Base de données non configurée'],
    }
  }

  const expectedDocs = await prisma.document.count({
    where: { intervention_id: interventionId },
  })

  let deletedDocs = 0
  if (expectedDocs > 0) {
    try {
      const result = await prisma.document.deleteMany({
        where: { intervention_id: interventionId },
      })
      deletedDocs = result.count
      if (deletedDocs < expectedDocs) {
        warnings.push(`delete documents incomplet: ${deletedDocs}/${expectedDocs} effacés`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warnings.push(`delete documents: ${msg}`)
    }
  }

  const folder = interventionId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
  const [pdfRes, photoRes] = await Promise.all([
    emptyBlobPrefix(`pdfs/${folder}/`),
    emptyBlobPrefix(`photos/${folder}/`),
  ])
  if (pdfRes.warning) warnings.push(pdfRes.warning)
  if (photoRes.warning) warnings.push(photoRes.warning)

  try {
    const result = await prisma.intervention.deleteMany({
      where: { id: interventionId },
    })
    if (result.count === 0) {
      return {
        ok: false, intervention_id: interventionId,
        deleted_documents: deletedDocs,
        deleted_photos: photoRes.count,
        deleted_pdfs: pdfRes.count,
        warnings: [...warnings, 'delete intervention: 0 ligne effacée (déjà supprimée ou ID invalide)'],
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false, intervention_id: interventionId,
      deleted_documents: deletedDocs,
      deleted_photos: photoRes.count,
      deleted_pdfs: pdfRes.count,
      warnings: [...warnings, `delete intervention: ${msg}`],
    }
  }

  return {
    ok: true, intervention_id: interventionId,
    deleted_documents: deletedDocs,
    deleted_photos: photoRes.count,
    deleted_pdfs: pdfRes.count,
    warnings,
  }
}

export async function cascadeDeleteDocument(documentId: string): Promise<
  | { kind: 'intervention'; result: CascadeDeleteResult }
  | { kind: 'document'; ok: boolean; warnings: string[] }
> {
  const warnings: string[] = []
  const prisma = getPrismaOrNull()
  if (!prisma) return { kind: 'document', ok: false, warnings: ['Base de données non configurée'] }

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, intervention_id: true, pdf_url: true },
  })
  if (!doc) return { kind: 'document', ok: false, warnings: ['Document introuvable'] }

  if (doc.intervention_id) {
    const result = await cascadeDeleteIntervention(doc.intervention_id)
    return { kind: 'intervention', result }
  }

  if (doc.pdf_url) {
    try {
      await deleteBlobs([doc.pdf_url])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warnings.push(`remove pdf: ${msg}`)
    }
  }

  try {
    const result = await prisma.document.deleteMany({ where: { id: documentId } })
    if (result.count === 0) {
      return { kind: 'document', ok: false, warnings: [...warnings, '0 ligne effacée (déjà supprimée ou ID invalide)'] }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { kind: 'document', ok: false, warnings: [...warnings, msg] }
  }
  return { kind: 'document', ok: true, warnings }
}
