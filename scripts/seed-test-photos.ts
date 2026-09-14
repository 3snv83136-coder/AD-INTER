import { disconnectScriptPrisma, getScriptPrisma } from './_prisma'

const SEED_PHOTOS = [
  'https://allodebouchage.com/media/gallery/before/IMG_6988.jpeg',
  'https://allodebouchage.com/media/gallery/after/IMG_6990.jpeg',
  'https://allodebouchage.com/media/gallery/before/IMG_7002.jpeg',
  'https://allodebouchage.com/media/gallery/after/IMG_7001.jpeg',
  'https://allodebouchage.com/media/gallery/before/IMG_7015.jpeg',
  'https://allodebouchage.com/media/gallery/after/IMG_7017.jpeg',
]

async function main() {
  const prisma = getScriptPrisma()

  const latest = await prisma.intervention.findFirst({
    where: { statut: 'terminee' },
    select: { id: true, reference: true, type_intervention: true, ville: true, photos_urls: true },
    orderBy: { date_realisee: 'desc' },
  })

  if (!latest) {
    console.error('❌ Aucune intervention terminée trouvée')
    process.exit(1)
  }

  console.log(`Cible : ${latest.reference || latest.id.slice(0, 8)} — ${latest.type_intervention || '?'} à ${latest.ville || '?'}`)
  console.log(`photos_urls actuel : ${JSON.stringify(latest.photos_urls)}`)

  await prisma.intervention.update({
    where: { id: latest.id },
    data: { photos_urls: SEED_PHOTOS },
  })

  console.log(`\n✅ Photos seedées (${SEED_PHOTOS.length} URLs publiques Allo Débouchage)`)
  console.log(`\n🎬 Va tester ici :`)
  console.log(`   http://localhost:3000/intervention/${latest.id}`)
  console.log(`\n   Tu devrais voir la card "Vidéo réseaux sociaux" avec un bouton "Générer la vidéo".`)

  await disconnectScriptPrisma()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
