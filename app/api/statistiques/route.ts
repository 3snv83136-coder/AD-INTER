import { NextRequest, NextResponse } from 'next/server'
import { dbNotConfiguredResponse, getPrismaOrNull } from '@/lib/db'
import { CANAUX_ACQUISITION } from '@/lib/canaux'

export const dynamic = 'force-dynamic'

function isoDate(d: Date | null): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

/**
 * Agrégation des interventions par canal d'acquisition.
 */
export async function GET(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error }, { status: err.status })
  }

  const url = new URL(req.url)
  const from = url.searchParams.get('from') || ''
  const to = url.searchParams.get('to') || ''
  const villeFilter = (url.searchParams.get('ville') || '').trim().toLowerCase()
  const departementFilter = (url.searchParams.get('departement') || '').trim()
  const canalFilter = (url.searchParams.get('canal') || '').trim()

  const interventions = await prisma.intervention.findMany({
    where: {
      ...(from || to
        ? {
            date_prevue: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(canalFilter ? { canal_acquisition: canalFilter } : {}),
    },
    select: {
      id: true,
      ville: true,
      code_postal: true,
      date_prevue: true,
      date_realisee: true,
      canal_acquisition: true,
      prix_prevu: true,
      statut: true,
    },
    take: 5000,
  })

  const filtered = interventions.filter(i => {
    if (villeFilter && (i.ville || '').toLowerCase() !== villeFilter) return false
    if (departementFilter && !(i.code_postal || '').startsWith(departementFilter)) return false
    return true
  })

  const interventionIds = filtered.map(i => i.id)

  let caByIntervention: Record<string, number> = {}
  if (interventionIds.length > 0) {
    const docs = await prisma.document.findMany({
      where: {
        type: 'facture',
        statut: { not: 'annule' },
        intervention_id: { in: interventionIds },
      },
      select: { intervention_id: true, montant_ttc: true },
    })
    docs.forEach(d => {
      if (!d.intervention_id) return
      caByIntervention[d.intervention_id] =
        (caByIntervention[d.intervention_id] || 0) + (Number(d.montant_ttc) || 0)
    })
  }

  const canalAgg: Record<string, { count: number; ca: number }> = {}
  CANAUX_ACQUISITION.forEach(c => { canalAgg[c.key] = { count: 0, ca: 0 } })
  canalAgg['__none__'] = { count: 0, ca: 0 }

  filtered.forEach(i => {
    const key = i.canal_acquisition || '__none__'
    if (!canalAgg[key]) canalAgg[key] = { count: 0, ca: 0 }
    canalAgg[key].count += 1
    canalAgg[key].ca += caByIntervention[i.id] || 0
  })

  const total = filtered.length || 1
  const par_canal = [
    ...CANAUX_ACQUISITION.map(c => ({
      canal: c.key,
      label: c.label,
      icon: c.icon,
      count: canalAgg[c.key].count,
      ca_ttc: canalAgg[c.key].ca,
      pct: filtered.length > 0 ? (canalAgg[c.key].count / total) * 100 : 0,
    })),
    {
      canal: '__none__',
      label: 'Non précisé',
      icon: '❔',
      count: canalAgg['__none__'].count,
      ca_ttc: canalAgg['__none__'].ca,
      pct: filtered.length > 0 ? (canalAgg['__none__'].count / total) * 100 : 0,
    },
  ].sort((a, b) => b.count - a.count)

  const villeMap: Record<string, { count: number; ca: number; cp: string }> = {}
  filtered.forEach(i => {
    const v = i.ville || '— Inconnu —'
    if (!villeMap[v]) villeMap[v] = { count: 0, ca: 0, cp: i.code_postal || '' }
    villeMap[v].count += 1
    villeMap[v].ca += caByIntervention[i.id] || 0
  })
  const par_ville = Object.entries(villeMap)
    .map(([ville, v]) => ({ ville, code_postal: v.cp, count: v.count, ca_ttc: v.ca }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  const depMap: Record<string, { count: number; ca: number }> = {}
  filtered.forEach(i => {
    const dep = (i.code_postal || '').slice(0, 2) || '—'
    if (!depMap[dep]) depMap[dep] = { count: 0, ca: 0 }
    depMap[dep].count += 1
    depMap[dep].ca += caByIntervention[i.id] || 0
  })
  const par_departement = Object.entries(depMap)
    .map(([departement, v]) => ({ departement, count: v.count, ca_ttc: v.ca }))
    .sort((a, b) => b.count - a.count)

  const moisMap: Record<string, number> = {}
  filtered.forEach(i => {
    const d = isoDate(i.date_prevue) || isoDate(i.date_realisee) || ''
    const m = /^(\d{4}-\d{2})/.exec(d)
    if (!m) return
    moisMap[m[1]] = (moisMap[m[1]] || 0) + 1
  })
  const par_mois = Object.entries(moisMap)
    .map(([mois, count]) => ({ mois, count }))
    .sort((a, b) => a.mois.localeCompare(b.mois))

  const total_ca_ttc = Object.values(caByIntervention).reduce((s, v) => s + v, 0)

  return NextResponse.json({
    total_interventions: filtered.length,
    total_ca_ttc,
    par_canal,
    par_ville,
    par_departement,
    par_mois,
    filtres: { from, to, ville: villeFilter, departement: departementFilter, canal: canalFilter },
  })
}
