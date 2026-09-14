/**
 * Test des suppressions : facture, devis, rapport/intervention, client.
 */
import { loadEnvLocal } from './_load-env'
import { disconnectScriptPrisma, getScriptPrisma } from './_prisma'

loadEnvLocal()

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'
const prisma = getScriptPrisma()

let pass = 0, fail = 0
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`) }
const ko = (m: string) => { fail++; console.log(`  ❌ ${m}`) }
const step = (m: string) => console.log(`\n━━ ${m} ━━`)

async function main() {
  console.log(`\n🧪 TEST SUPPRESSIONS — ${BASE}\n`)

  step('SETUP — création des données de test')
  const client = await prisma.client.create({
    data: { nom: 'ZZ Test Suppression', email: 'zz-suppr@e2e.fr' },
    select: { id: true },
  })
  const clientId = client.id
  ok(`Client test créé (${clientId.slice(0, 8)})`)

  const interv = await prisma.intervention.create({
    data: {
      type_intervention: 'Débouchage canalisation',
      ville: 'Toulon', code_postal: '83000',
      client_id: clientId, statut: 'terminee',
      rapport_json: { objet: 'Rapport test suppression', diagnostic: 'test' },
    },
    select: { id: true, reference: true },
  })
  const intervId = interv.id
  ok(`Intervention test créée avec rapport (${intervId.slice(0, 8)})`)

  const facture = await prisma.document.create({
    data: {
      type: 'facture', numero: `FA-TEST-${Date.now()}`,
      intervention_id: intervId, client_id: clientId,
      montant_ht: 250, montant_ttc: 275, tva_taux: 10,
      statut: 'brouillon', payload: { lignes: [] },
    },
    select: { id: true },
  })
  const factureId = facture.id
  ok(`Facture test créée (${factureId.slice(0, 8)})`)

  const devis = await prisma.document.create({
    data: {
      type: 'devis', numero: `DV-TEST-${Date.now()}`,
      intervention_id: intervId, client_id: clientId,
      montant_ht: 100, montant_ttc: 110, tva_taux: 10,
      statut: 'brouillon', payload: { lignes: [] },
    },
    select: { id: true },
  })
  const devisId = devis.id
  ok(`Devis test créé (${devisId.slice(0, 8)})`)

  step('0 — DELETE client avec liens → doit être REFUSÉ (409)')
  {
    const res = await fetch(`${BASE}/api/clients/${clientId}`, { method: 'DELETE' })
    const body = await res.json().catch(() => null)
    if (res.status === 409) {
      ok(`Suppression bloquée (409) — ${body?.interventions} interv. + ${body?.documents} docs détectés`)
    } else {
      ko(`attendu 409, reçu ${res.status} ${JSON.stringify(body)}`)
    }
    const check = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } })
    check ? ok('Client toujours présent (non supprimé)') : ko('Client supprimé alors qu\'il avait des liens !')
  }

  step('1 — DELETE facture (/api/historique/[id])')
  {
    const res = await fetch(`${BASE}/api/historique/${factureId}`, { method: 'DELETE' })
    const body = await res.json().catch(() => null)
    res.ok && body?.ok ? ok('Route DELETE facture → 200 ok') : ko(`DELETE facture → ${res.status} ${JSON.stringify(body)}`)
    const check = await prisma.document.findUnique({ where: { id: factureId }, select: { id: true } })
    check === null ? ok('Facture absente de la base') : ko('Facture toujours en base')
    const res2 = await fetch(`${BASE}/api/historique/${factureId}`, { method: 'DELETE' })
    res2.status === 404 ? ok('Double suppression → 404 (pas de faux succès)') : ko(`Double suppression → ${res2.status}`)
  }

  step('2 — DELETE devis (/api/historique/[id])')
  {
    const res = await fetch(`${BASE}/api/historique/${devisId}`, { method: 'DELETE' })
    const body = await res.json().catch(() => null)
    res.ok && body?.ok ? ok('Route DELETE devis → 200 ok') : ko(`DELETE devis → ${res.status} ${JSON.stringify(body)}`)
    const check = await prisma.document.findUnique({ where: { id: devisId }, select: { id: true } })
    check === null ? ok('Devis absent de la base') : ko('Devis toujours en base')
  }

  step('3 — DELETE intervention+rapport (/api/interventions/[id]?hard=1)')
  {
    const res = await fetch(`${BASE}/api/interventions/${intervId}?hard=1`, { method: 'DELETE' })
    const body = await res.json().catch(() => null)
    res.ok && body?.ok ? ok('Route DELETE intervention hard → 200 ok') : ko(`DELETE intervention → ${res.status} ${JSON.stringify(body)}`)
    const check = await prisma.intervention.findUnique({ where: { id: intervId }, select: { id: true } })
    check === null ? ok('Intervention + rapport absents de la base') : ko('Intervention toujours en base')
  }

  step('4 — DELETE client (/api/clients/[id])')
  {
    const res = await fetch(`${BASE}/api/clients/${clientId}`, { method: 'DELETE' })
    const body = await res.json().catch(() => null)
    if (res.status === 405 || res.status === 404) {
      ko(`Route DELETE client ABSENTE (HTTP ${res.status}) — à implémenter`)
    } else if (res.ok && body?.ok) {
      ok('Route DELETE client → 200 ok')
      const check = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } })
      check === null ? ok('Client absent de la base') : ko('Client toujours en base')
    } else {
      ko(`DELETE client → ${res.status} ${JSON.stringify(body)}`)
    }
  }

  step('CLEANUP')
  await prisma.document.deleteMany({ where: { intervention_id: intervId } })
  await prisma.intervention.deleteMany({ where: { id: intervId } })
  await prisma.client.deleteMany({ where: { id: clientId } })
  ok('Données de test nettoyées')

  console.log(`\n${'═'.repeat(46)}`)
  console.log(`  RÉSULTAT : ${pass} ✅   ${fail} ❌`)
  console.log(`${'═'.repeat(46)}`)
  if (fail > 0) process.exit(1)
}

main()
  .catch(e => { console.error('\n💥', e); process.exit(1) })
  .finally(() => disconnectScriptPrisma())
