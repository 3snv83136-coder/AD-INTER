import { listBlobPrefix } from '../lib/storage'
import { disconnectScriptPrisma, getScriptPrisma } from './_prisma'

async function main() {
  const prisma = getScriptPrisma()

  const all = await prisma.intervention.findMany({
    where: { statut: 'terminee' },
    select: {
      id: true, reference: true, type_intervention: true, ville: true,
      statut: true, photos_urls: true, rapport_json: true, publie_slug: true,
    },
    orderBy: { date_realisee: 'desc' },
    take: 20,
  })

  console.log(`📊 ${all.length} interventions terminées\n`)

  let withRapportPhotos = 0
  let withPubliesSlug = 0
  for (const i of all) {
    const rapport = i.rapport_json as { photos?: unknown[]; images?: unknown[] } | null
    const rapportPhotos = rapport?.photos || rapport?.images || []
    if (Array.isArray(rapportPhotos) && rapportPhotos.length > 0) withRapportPhotos++
    if (i.publie_slug) withPubliesSlug++
  }

  console.log(`Avec photos dans rapport_json : ${withRapportPhotos}`)
  console.log(`Avec publie_slug (publié sur allodebouchage.com) : ${withPubliesSlug}\n`)

  if (all.length > 0) {
    const sample = all[0]
    console.log(`Exemple — intervention ${sample.reference || sample.id.slice(0, 8)} :`)
    console.log(`  photos_urls = ${JSON.stringify(sample.photos_urls)}`)
    console.log(`  publie_slug = ${sample.publie_slug}`)
    if (sample.rapport_json) {
      const rj = sample.rapport_json as Record<string, unknown>
      console.log(`  rapport_json keys = ${Object.keys(rj).join(', ')}`)
      const rp = rj.photos || rj.images
      if (rp) console.log(`  rapport_json.photos/images = ${JSON.stringify(rp).slice(0, 200)}`)
    }
  }

  const { blobs } = await listBlobPrefix('photos/')
  console.log(`\nBlobs photos/ (top 20) :`)
  for (const f of blobs.slice(0, 20)) {
    console.log(`  - ${f.pathname}`)
  }

  await disconnectScriptPrisma()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
