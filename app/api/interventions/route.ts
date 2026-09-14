import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { getSessionUser, technicienFilterForSession } from "@/lib/intervention-access"
import { getPrismaOrNull, dbNotConfiguredResponse } from "@/lib/db"
import { upsertClient, patchClient } from "@/lib/db-helpers"
import { isCanalAcquisition } from "@/lib/canaux"
import { FLUX_CRM, FLUX_RAPPORTEUR, isRapporteurFlux } from "@/lib/rapporteur"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type ClientInput = {
  id?: string | null
  nom?: string | null
  email?: string | null
  telephone?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
}

type CreateInterventionBody = {
  client?: ClientInput
  technicien_id?: string | null
  sous_traitant_id?: string | null
  flux?: string | null
  agence?: string | null
  type_intervention?: string | null
  adresse_chantier?: string | null
  ville?: string | null
  code_postal?: string | null
  date_prevue?: string | null
  heure_prevue?: string | null
  duree_estimee_min?: number | null
  urgence?: boolean
  prix_prevu?: number | null
  notes_internes?: string | null
  canal_acquisition?: string | null
}

function formatDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null
}

function formatTime(d: Date | null | undefined): string | null {
  if (!d) return null
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mi}`
}

function serializeIntervention(row: Record<string, unknown>) {
  return {
    ...row,
    date_prevue: formatDate(row.date_prevue as Date | null),
    date_realisee: formatDate(row.date_realisee as Date | null),
    heure_prevue: formatTime(row.heure_prevue as Date | null),
    prix_prevu: row.prix_prevu != null ? Number(row.prix_prevu) : null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    rapporteur_envoye_at: row.rapporteur_envoye_at instanceof Date
      ? row.rapporteur_envoye_at.toISOString()
      : row.rapporteur_envoye_at,
  }
}

function buildReference(date_prevue?: string | null, heure_prevue?: string | null): string {
  const now = new Date()
  let datePart: string
  let timePart: string

  if (date_prevue && /^\d{4}-\d{2}-\d{2}$/.test(date_prevue)) {
    datePart = date_prevue.replace(/-/g, '')
  } else {
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    datePart = `${yyyy}${mm}${dd}`
  }

  if (heure_prevue && /^\d{2}:\d{2}/.test(heure_prevue)) {
    timePart = heure_prevue.slice(0, 5).replace(':', '')
  } else {
    const hh = String(now.getHours()).padStart(2, '0')
    const mi = String(now.getMinutes()).padStart(2, '0')
    timePart = `${hh}${mi}`
  }

  return `Allo Débouchage-${datePart}-${timePart}`
}

function parseHeurePrevue(s: string | null | undefined): Date | null {
  if (!s || !/^\d{2}:\d{2}/.test(s)) return null
  const [hh, mi] = s.slice(0, 5).split(':').map(Number)
  return new Date(Date.UTC(1970, 0, 1, hh, mi, 0))
}

export async function GET(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error, interventions: [] }, { status })
  }

  const url = new URL(req.url)
  const statut = url.searchParams.get('statut')
  const technicien_id = url.searchParams.get('technicien_id')
  const sessionUser = await getSessionUser()
  const sessionTechId = technicienFilterForSession(sessionUser)
  const agence = url.searchParams.get('agence')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const fluxParam = url.searchParams.get('flux')
  const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 500)

  const where: Prisma.InterventionWhereInput = {}
  if (statut) where.statut = statut
  if (sessionTechId) where.technicien_id = sessionTechId
  else if (technicien_id) where.technicien_id = technicien_id
  if (agence) where.agence = agence
  if (fluxParam === 'all') {
    /* pas de filtre flux */
  } else if (fluxParam === FLUX_RAPPORTEUR) {
    where.flux = FLUX_RAPPORTEUR
  } else {
    where.flux = FLUX_CRM
  }
  if (from || to) {
    where.date_prevue = {}
    if (from) where.date_prevue.gte = new Date(from)
    if (to) where.date_prevue.lte = new Date(to)
  }

  try {
    const interventions = await prisma.intervention.findMany({
      where,
      select: {
        id: true, reference: true, client_id: true, technicien_id: true, agence: true,
        type_intervention: true, adresse_chantier: true, ville: true, code_postal: true,
        date_prevue: true, heure_prevue: true, duree_estimee_min: true, date_realisee: true,
        urgence: true, statut: true, prix_prevu: true, notes_internes: true, publie_slug: true,
        canal_acquisition: true, terrain_step: true, flux: true, sous_traitant_id: true,
        rapporteur_envoye_at: true, rapporteur_facture_id: true,
        created_at: true, updated_at: true,
      },
      orderBy: [{ date_prevue: { sort: 'asc', nulls: 'last' } }, { heure_prevue: { sort: 'asc', nulls: 'last' } }],
      take: limit,
    })

    const clientIds = new Set<string>()
    const techIds = new Set<string>()
    const stIds = new Set<string>()
    interventions.forEach(i => {
      if (i.client_id) clientIds.add(i.client_id)
      if (i.technicien_id) techIds.add(i.technicien_id)
      if (i.sous_traitant_id) stIds.add(i.sous_traitant_id)
    })

    const [clientsRes, techsRes, stRes] = await Promise.all([
      clientIds.size > 0
        ? prisma.client.findMany({
            where: { id: { in: Array.from(clientIds) } },
            select: { id: true, nom: true, email: true, telephone: true },
          })
        : Promise.resolve([]),
      techIds.size > 0
        ? prisma.technicien.findMany({
            where: { id: { in: Array.from(techIds) } },
            select: { id: true, nom: true, email: true },
          })
        : Promise.resolve([]),
      stIds.size > 0
        ? prisma.sousTraitant.findMany({
            where: { id: { in: Array.from(stIds) } },
            select: { id: true, nom: true, email: true, telephone: true },
          })
        : Promise.resolve([]),
    ])

    const clientsMap: Record<string, { nom: string; email: string | null; telephone: string | null }> = {}
    clientsRes.forEach(c => { clientsMap[c.id] = { nom: c.nom, email: c.email, telephone: c.telephone } })
    const techsMap: Record<string, { nom: string; email: string | null }> = {}
    techsRes.forEach(t => { techsMap[t.id] = { nom: t.nom, email: t.email } })
    const stMap: Record<string, { nom: string; email: string | null; telephone: string | null }> = {}
    stRes.forEach(s => { stMap[s.id] = { nom: s.nom, email: s.email, telephone: s.telephone } })

    const decorated = interventions.map(i => {
      const row = serializeIntervention(i as unknown as Record<string, unknown>)
      const st = i.sous_traitant_id ? stMap[i.sous_traitant_id] : null
      return {
        ...row,
        client_nom: i.client_id ? clientsMap[i.client_id]?.nom ?? null : null,
        client_email: i.client_id ? clientsMap[i.client_id]?.email ?? null : null,
        client_telephone: i.client_id ? clientsMap[i.client_id]?.telephone ?? null : null,
        technicien_nom: i.technicien_id ? techsMap[i.technicien_id]?.nom ?? null : null,
        technicien_email: i.technicien_id ? techsMap[i.technicien_id]?.email ?? null : null,
        sous_traitant_nom: st?.nom ?? null,
        sous_traitant_email: st?.email ?? null,
        sous_traitant_telephone: st?.telephone ?? null,
        rapporteur_envoye_at: i.rapporteur_envoye_at instanceof Date
          ? i.rapporteur_envoye_at.toISOString()
          : i.rapporteur_envoye_at,
      }
    })

    return NextResponse.json({ interventions: decorated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: msg, interventions: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  let body: CreateInterventionBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (!body.type_intervention) {
    return NextResponse.json({ error: 'type_intervention requis' }, { status: 400 })
  }

  let clientId: string | null = null
  if (body.client?.id) {
    clientId = body.client.id
    await patchClient(clientId, {
      nom: body.client.nom ?? null,
      email: body.client.email ?? null,
      telephone: body.client.telephone ?? null,
      adresse: body.client.adresse ?? null,
      code_postal: body.client.code_postal ?? null,
      ville: body.client.ville ?? null,
    })
  } else if (body.client?.nom && body.client.nom.trim()) {
    clientId = await upsertClient({
      nom: body.client.nom,
      email: body.client.email ?? null,
      telephone: body.client.telephone ?? null,
      adresse: body.client.adresse ?? null,
      code_postal: body.client.code_postal ?? null,
      ville: body.client.ville ?? null,
    })
    if (!clientId) {
      return NextResponse.json({ error: 'Création du client impossible' }, { status: 500 })
    }
  } else {
    return NextResponse.json(
      { error: 'Nom du client requis (envoyez body.client.nom ou body.client.id).' },
      { status: 400 },
    )
  }

  const baseReference = buildReference(body.date_prevue, body.heure_prevue)

  const adresseChantier = body.adresse_chantier ?? body.client?.adresse ?? null
  const ville = body.ville ?? body.client?.ville ?? null
  const codePostal = body.code_postal ?? body.client?.code_postal ?? null

  const heurePrevueClean = body.heure_prevue && /^\d{2}:\d{2}/.test(body.heure_prevue)
    ? body.heure_prevue.slice(0, 5)
    : null

  const canalClean = isCanalAcquisition(body.canal_acquisition) ? body.canal_acquisition : null
  const flux = isRapporteurFlux(body.flux) ? FLUX_RAPPORTEUR : FLUX_CRM
  const sousTraitantId = body.sous_traitant_id?.trim() || null

  if (flux === FLUX_RAPPORTEUR && !sousTraitantId) {
    return NextResponse.json({ error: 'Sous-traitant requis pour le rapporteur d’affaires' }, { status: 400 })
  }

  const baseRow = {
    client_id: clientId,
    technicien_id: flux === FLUX_RAPPORTEUR ? null : (body.technicien_id || null),
    sous_traitant_id: flux === FLUX_RAPPORTEUR ? sousTraitantId : null,
    flux,
    agence: body.agence || null,
    type_intervention: body.type_intervention,
    adresse_chantier: adresseChantier,
    ville,
    code_postal: codePostal,
    date_prevue: body.date_prevue && /^\d{4}-\d{2}-\d{2}$/.test(body.date_prevue) ? new Date(body.date_prevue) : null,
    heure_prevue: parseHeurePrevue(heurePrevueClean),
    duree_estimee_min: typeof body.duree_estimee_min === 'number' ? body.duree_estimee_min : null,
    urgence: !!body.urgence,
    statut: 'planifiee',
    prix_prevu: typeof body.prix_prevu === 'number' ? body.prix_prevu : null,
    notes_internes: body.notes_internes || null,
    canal_acquisition: canalClean,
  }

  let inserted: Record<string, unknown> | null = null
  let insertErr: Error | null = null
  let currentRef = baseReference
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const data = await prisma.intervention.create({
        data: { reference: currentRef, ...baseRow },
      })
      inserted = data as unknown as Record<string, unknown>
      insertErr = null
      break
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code === 'P2002') {
        const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
        currentRef = `${baseReference}-${suffix}`
        continue
      }
      insertErr = e instanceof Error ? e : new Error(String(e))
      break
    }
  }

  if (insertErr || !inserted) {
    return NextResponse.json({ error: insertErr?.message || 'Insertion échouée' }, { status: 500 })
  }

  if (inserted.technicien_id) {
    notifyTechBestEffort(req, inserted.id as string, inserted.technicien_id as string).catch(e => {
      console.error('[interventions.POST notify]', e)
    })
  }

  return NextResponse.json({ intervention: serializeIntervention(inserted) }, { status: 201 })
}

async function notifyTechBestEffort(req: NextRequest, interventionId: string, technicienId: string) {
  const prisma = getPrismaOrNull()
  if (!prisma) return

  const tech = await prisma.technicien.findUnique({
    where: { id: technicienId },
    select: { id: true, nom: true, email: true },
  })

  if (!tech?.email) return

  const i = await prisma.intervention.findUnique({ where: { id: interventionId } })
  if (!i) return

  let clientNom: string | null = null
  let clientTel: string | null = null
  let clientEmail: string | null = null
  if (i.client_id) {
    const c = await prisma.client.findUnique({
      where: { id: i.client_id },
      select: { nom: true, email: true, telephone: true },
    })
    clientNom = c?.nom ?? null
    clientTel = c?.telephone ?? null
    clientEmail = c?.email ?? null
  }

  const origin = new URL(req.url).origin
  await fetch(`${origin}/api/notify-technicien`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-auth': process.env.NEXTAUTH_SECRET || '',
    },
    body: JSON.stringify({
      intervention_id: interventionId,
      technicien_email: tech.email,
      technicien_nom: tech.nom,
      client_nom: clientNom,
      client_telephone: clientTel,
      client_email: clientEmail,
      adresse_chantier: i.adresse_chantier,
      ville: i.ville,
      code_postal: i.code_postal,
      date_prevue: formatDate(i.date_prevue),
      heure_prevue: formatTime(i.heure_prevue),
      type_intervention: i.type_intervention,
      urgence: i.urgence,
      prix_prevu: i.prix_prevu != null ? Number(i.prix_prevu) : null,
      notes_internes: i.notes_internes,
    }),
  }).catch(e => console.error('[notifyTechBestEffort fetch]', e))
}
