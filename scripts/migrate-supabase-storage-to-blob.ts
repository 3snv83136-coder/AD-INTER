/**
 * Migration one-shot : copie les fichiers Supabase Storage vers Vercel Blob.
 * Nécessite temporairement SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en env.
 *
 * Usage :
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... BLOB_READ_WRITE_TOKEN=... \
 *   DATABASE_URL=... npx tsx scripts/migrate-supabase-storage-to-blob.ts
 */
import { createClient } from '@supabase/supabase-js'
import { getScriptPrisma, disconnectScriptPrisma } from './_prisma'
import { uploadBlob } from '../lib/storage'

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis pour la migration storage')
    process.exit(1)
  }

  const sb = createClient(url, key, { auth: { persistSession: false } })
  const prisma = getScriptPrisma()

  const buckets = [
    { bucket: 'intervention-pdfs', prefix: 'pdfs' },
    { bucket: 'interventions-photos', prefix: 'photos' },
    { bucket: 'intervention-videos', prefix: 'videos' },
    { bucket: 'accords-pdfs', prefix: 'accords' },
  ]

  let migrated = 0
  for (const { bucket, prefix } of buckets) {
    const { data: folders } = await sb.storage.from(bucket).list('', { limit: 1000 })
    for (const folder of folders || []) {
      if (!folder.name) continue
      const { data: files } = await sb.storage.from(bucket).list(folder.name, { limit: 1000 })
      for (const file of files || []) {
        const path = `${folder.name}/${file.name}`
        const { data: blob, error } = await sb.storage.from(bucket).download(path)
        if (error || !blob) continue
        const buf = Buffer.from(await blob.arrayBuffer())
        const newUrl = await uploadBlob({
          pathname: `${prefix}/${path}`,
          body: buf,
          contentType: blob.type || 'application/octet-stream',
        })
        console.log(`✓ ${bucket}/${path} → ${newUrl}`)
        migrated++
      }
    }
  }

  console.log(`\n${migrated} fichier(s) migré(s). Mettez à jour les URLs en base si nécessaire.`)
  await disconnectScriptPrisma()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
