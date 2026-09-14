import { getPrisma } from '@/lib/db'
import {
  bornesMois,
  computeComptaKpis,
  periodeLabel,
  type DepenseKpi,
  type RecetteKpi,
} from '@/lib/compta-kpis'

export type PreBilanSnapshot = {
  periode: string
  periode_label: string
  kpis: ReturnType<typeof computeComptaKpis>
  recettes_count: number
  depenses_count: number
  factures_impayees: Array<{ id: string; numero: string | null; montant_ttc: number | null; client_nom: string | null }>
  operations_total: number
  operations_lettrees: number
  operations_non_lettrees: number
  taux_rapprochement: number
  releve_present: boolean
  releve_id: string | null
  alertes: string[]
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function buildPreBilanSnapshot(
  annee: number,
  mois: number,
): Promise<PreBilanSnapshot> {
  const prisma = getPrisma()
  const { from, to } = bornesMois(annee, mois)
  const periode = `${annee}-${String(mois).padStart(2, '0')}`
  const fromDate = new Date(from)
  const toDate = new Date(to)

  const recRows = await prisma.document.findMany({
    where: {
      type: 'facture',
      date_emission: { gte: fromDate, lte: toDate },
    },
    select: {
      id: true,
      numero: true,
      date_emission: true,
      statut: true,
      montant_ht: true,
      montant_ttc: true,
      client_id: true,
    },
  })

  const clientIds = Array.from(new Set(recRows.map(r => r.client_id).filter((v): v is string => !!v)))
  let clientsMap: Record<string, string> = {}
  if (clientIds.length > 0) {
    const cls = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, nom: true },
    })
    clientsMap = Object.fromEntries(cls.map(c => [c.id, c.nom || '']))
  }

  const recettes: RecetteKpi[] = recRows.map(r => ({
    id: r.id,
    numero: r.numero,
    date_emission: isoDate(r.date_emission),
    statut: r.statut || '',
    montant_ht: r.montant_ht != null ? Number(r.montant_ht) : null,
    montant_ttc: r.montant_ttc != null ? Number(r.montant_ttc) : null,
    client_nom: r.client_id ? clientsMap[r.client_id] || null : null,
  }))

  const depRows = await prisma.factureFournisseur.findMany({
    where: { date_facture: { gte: fromDate, lte: toDate } },
    select: {
      id: true,
      fournisseur: true,
      date_facture: true,
      montant_ht: true,
      montant_ttc: true,
      tva: true,
      categorie: true,
    },
  })

  const depenses: DepenseKpi[] = depRows.map(d => ({
    id: d.id,
    fournisseur: d.fournisseur || '',
    date_facture: isoDate(d.date_facture),
    montant_ht: Number(d.montant_ht) || 0,
    montant_ttc: Number(d.montant_ttc) || 0,
    tva: Number(d.tva) || 0,
    categorie: d.categorie,
  }))

  const impayees = await prisma.document.findMany({
    where: {
      type: 'facture',
      statut: { in: ['envoye', 'brouillon'] },
      date_emission: { lte: toDate },
    },
    select: { id: true, numero: true, montant_ttc: true, client_id: true, statut: true },
  })

  const impClientIds = Array.from(new Set(impayees.map(r => r.client_id).filter((v): v is string => !!v)))
  if (impClientIds.length > 0) {
    const cls = await prisma.client.findMany({
      where: { id: { in: impClientIds } },
      select: { id: true, nom: true },
    })
    for (const c of cls) clientsMap[c.id] = c.nom || ''
  }

  const releve = await prisma.releveBancaire.findFirst({
    where: { periode_annee: annee, periode_mois: mois },
    select: { id: true },
  })

  const ops = await prisma.operationBancaire.findMany({
    where: { date_operation: { gte: fromDate, lte: toDate } },
    select: { id: true, lettre: true },
  })

  const operations_total = ops.length
  const operations_lettrees = ops.filter(o => o.lettre).length
  const operations_non_lettrees = operations_total - operations_lettrees
  const taux_rapprochement = operations_total > 0
    ? Math.round((operations_lettrees / operations_total) * 1000) / 10
    : 0

  const alertes: string[] = []
  if (!releve?.id) alertes.push('Relevé bancaire manquant pour cette période')
  if (operations_non_lettrees > 0) {
    alertes.push(`${operations_non_lettrees} opération(s) bancaire(s) non rapprochée(s)`)
  }
  const sansCategorie = depenses.filter(d => !d.categorie).length
  if (sansCategorie > 0) alertes.push(`${sansCategorie} dépense(s) sans catégorie`)

  const kpis = computeComptaKpis(recettes, depenses)

  return {
    periode,
    periode_label: periodeLabel(annee, mois),
    kpis,
    recettes_count: recettes.filter(r => r.statut !== 'annule').length,
    depenses_count: depenses.length,
    factures_impayees: impayees.map(r => ({
      id: r.id,
      numero: r.numero,
      montant_ttc: r.montant_ttc != null ? Number(r.montant_ttc) : null,
      client_nom: r.client_id ? clientsMap[r.client_id] || null : null,
    })),
    operations_total,
    operations_lettrees,
    operations_non_lettrees,
    taux_rapprochement,
    releve_present: !!releve?.id,
    releve_id: releve?.id || null,
    alertes,
  }
}

export async function upsertPreBilan(
  annee: number,
  mois: number,
): Promise<{ id: string; snapshot: PreBilanSnapshot }> {
  const prisma = getPrisma()
  const snapshot = await buildPreBilanSnapshot(annee, mois)

  const existing = await prisma.preBilan.findUnique({
    where: { periode_annee_periode_mois: { periode_annee: annee, periode_mois: mois } },
    select: { id: true },
  })

  if (existing) {
    const data = await prisma.preBilan.update({
      where: { id: existing.id },
      data: {
        snapshot,
        releve_id: snapshot.releve_id,
      },
      select: { id: true },
    })
    return { id: data.id, snapshot }
  }

  const data = await prisma.preBilan.create({
    data: {
      periode_annee: annee,
      periode_mois: mois,
      snapshot,
      releve_id: snapshot.releve_id,
      statut: 'brouillon',
    },
    select: { id: true },
  })

  return { id: data.id, snapshot }
}
