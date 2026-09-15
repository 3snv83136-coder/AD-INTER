import { NextRequest, NextResponse } from "next/server"
import { dbNotConfiguredResponse, getPrismaOrNull } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({
      error,
      interventions: [],
      documents: [],
    }, { status })
  }

  const url = new URL(req.url)
  const search = (url.searchParams.get('q') || '').trim().toLowerCase()
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500)

  try {
    const [rawInterventions, rawDocuments] = await Promise.all([
      prisma.intervention.findMany({
        select: {
          id: true,
          reference: true,
          type_intervention: true,
          adresse_chantier: true,
          ville: true,
          code_postal: true,
          date_realisee: true,
          date_prevue: true,
          statut: true,
          agence: true,
          publie_slug: true,
          created_at: true,
          client_id: true,
          technicien_id: true,
          rapport_json: true,
          photos_urls: true,
          pdf_rapport_url: true,
          flux: true,
        },
        orderBy: { created_at: 'desc' },
        take: limit,
      }),
      prisma.document.findMany({
        select: {
          id: true,
          type: true,
          numero: true,
          agence: true,
          date_emission: true,
          echeance: true,
          statut: true,
          montant_ht: true,
          montant_ttc: true,
          tva_taux: true,
          pdf_url: true,
          envoye_email: true,
          envoye_at: true,
          intervention_id: true,
          client_id: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
        take: limit,
      }),
    ])

    const filteredInterventions = rawInterventions.filter(i => i.statut !== 'annulee')
    const filteredDocuments = rawDocuments.filter(d => d.statut !== 'annule')

    const clientIds = new Set<string>()
    filteredInterventions.forEach(i => i.client_id && clientIds.add(i.client_id))
    filteredDocuments.forEach(d => d.client_id && clientIds.add(d.client_id))

    let clients: Record<string, {
      id: string; nom: string; email: string | null
      adresse: string | null; code_postal: string | null; ville: string | null
    }> = {}
    if (clientIds.size > 0) {
      const clientsData = await prisma.client.findMany({
        where: { id: { in: Array.from(clientIds) } },
        select: { id: true, nom: true, email: true, adresse: true, code_postal: true, ville: true },
      })
      clients = Object.fromEntries(clientsData.map(c => [c.id, c]))
    }

    const techIds = new Set<string>()
    filteredInterventions.forEach(i => i.technicien_id && techIds.add(i.technicien_id))
    let techniciens: Record<string, { id: string; nom: string; agence: string | null }> = {}
    if (techIds.size > 0) {
      const techData = await prisma.technicien.findMany({
        where: { id: { in: Array.from(techIds) } },
        select: { id: true, nom: true, agence: true },
      })
      techniciens = Object.fromEntries(techData.map(t => [t.id, t]))
    }

    const decoratedInterventions = filteredInterventions.map(i => {
      const c = i.client_id ? clients[i.client_id] : null
      const t = i.technicien_id ? techniciens[i.technicien_id] : null
      const rapport = i.rapport_json as Record<string, unknown> | null
      return {
        ...i,
        date_realisee: i.date_realisee?.toISOString().slice(0, 10) ?? null,
        date_prevue: i.date_prevue?.toISOString().slice(0, 10) ?? null,
        created_at: i.created_at.toISOString(),
        client_nom: c?.nom || null,
        client_email: c?.email || null,
        client_adresse: c?.adresse || null,
        client_code_postal: c?.code_postal || null,
        client_ville: c?.ville || null,
        technicien_nom: t?.nom || null,
        has_rapport: !!(rapport && Object.keys(rapport).length > 0),
      }
    })

    const decoratedDocuments = filteredDocuments.map(d => {
      const c = d.client_id ? clients[d.client_id] : null
      return {
        ...d,
        date_emission: d.date_emission.toISOString().slice(0, 10),
        montant_ht: d.montant_ht != null ? Number(d.montant_ht) : null,
        montant_ttc: d.montant_ttc != null ? Number(d.montant_ttc) : null,
        tva_taux: d.tva_taux != null ? Number(d.tva_taux) : null,
        envoye_at: d.envoye_at?.toISOString() ?? null,
        created_at: d.created_at.toISOString(),
        client_nom: c?.nom || null,
        client_email: c?.email || null,
        client_adresse: c?.adresse || null,
        client_code_postal: c?.code_postal || null,
        client_ville: c?.ville || null,
      }
    })

    const filterByQ = <T extends Record<string, unknown>>(rows: T[]) => {
      if (!search) return rows
      return rows.filter(r => {
        const blob = [
          r.reference, r.numero, r.client_nom, r.client_email,
          r.ville, r.client_ville, r.type_intervention, r.agence, r.publie_slug,
        ].filter(Boolean).join(' ').toLowerCase()
        return blob.includes(search)
      })
    }

    return NextResponse.json({
      interventions: filterByQ(decoratedInterventions),
      documents: filterByQ(decoratedDocuments),
    })
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Erreur de chargement',
      interventions: [],
      documents: [],
    }, { status: 500 })
  }
}
