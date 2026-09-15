import { del, list, put } from '@vercel/blob'

export type BlobUploadInput = {
  pathname: string
  body: Buffer | Blob | ArrayBuffer | ReadableStream | string
  contentType?: string
  access?: 'public'
}

/** Upload un fichier vers Vercel Blob. */
export async function uploadBlob(input: BlobUploadInput): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN non configurée')

  const result = await put(input.pathname, input.body, {
    access: input.access ?? 'public',
    contentType: input.contentType,
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return result.url
}

/** Supprime un ou plusieurs blobs par URL. */
export async function deleteBlobs(urls: string[]): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token || urls.length === 0) return
  await del(urls, { token })
}

/** Liste les blobs sous un préfixe (ex: `photos/uuid/`). */
export async function listBlobPrefix(prefix: string) {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return { blobs: [] as { url: string; pathname: string }[] }
  const result = await list({ prefix, token })
  return result
}

/** Chemins Blob standardisés */
export const blobPaths = {
  pdf: (interventionId: string, name: string) => `pdfs/${interventionId}/${name}`,
  photo: (interventionId: string, filename: string) => `photos/${interventionId}/${filename}`,
  video: (interventionId: string, filename: string) => `videos/${interventionId}/${filename}`,
  accord: (accordId: string) => `accords/${accordId}.pdf`,
  contratSousTraitance: (interventionId: string, filename: string) =>
    `contrats/${interventionId}/${filename}`,
  releve: (compteId: string, annee: number, mois: number) =>
    `releves/${compteId}/${annee}-${String(mois).padStart(2, '0')}.pdf`,
}

/** Extrait le pathname d'une URL Blob Vercel pour suppression. */
export function blobUrlToPathname(url: string): string | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('blob.vercel-storage.com')) return null
    return u.pathname.replace(/^\//, '')
  } catch {
    return null
  }
}

/** Compat migration Supabase : détecte si l'URL est un ancien lien Supabase Storage. */
export function isSupabaseStorageUrl(url: string): boolean {
  return url.includes('.supabase.co/storage/') || url.includes('.supabase.in/storage/')
}
