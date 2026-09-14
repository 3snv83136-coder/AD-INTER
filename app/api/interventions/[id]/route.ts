import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { getSessionUser, assertInterventionAccess } from "@/lib/intervention-access"
import { getPrismaOrNull, dbNotConfiguredResponse } from "@/lib/db"
import { isCanalAcquisition } from "@/lib/canaux"
import { cascadeDeleteIntervention } from "@/lib/cascadeDelete"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

const UPDATABLE = new Set([
  'statut',
  'technicien_id',
  'agence',
  'type_intervention',
  'adresse_chantier',
  'ville',
  'code_postal',
  'date_prevue',
  'heure_prevue',
  'duree_estimee_min',
  'urgence',
  'prix_prevu',
  'notes_internes',
  'date_realisee',
  'canal_acquisition',
])

const ALLOWED_STATUTS = new Set(['planifiee', 'en_cours', 'terminee', 'annulee'])

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
  const out: Record<string, unknown> = { ...row }
  if (row.date_prevue instanceof Date) out.date_prevue = formatDate(row.date_prevue)
  if (row.date_realisee instanceof Date) out.date_realisee = formatDate(row.date_realisee)
  if (row.heure_prevue instanceof Date) out.heure_prevue = formatTime(row.heure_prevue)
  if (row.heure_debut_reelle instanceof Date) out.heure_debut_reelle = row.heure_debut_reelle.toISOString()
  if (row.heure_fin_reelle instanceof Date) out.heure_fin_reelle = row.heure_fin_reelle.toISOString()
  if (row.prix_prevu != null) out.prix_prevu = Number(row.prix_prevu)
  if (row.created_at instanceof Date) out.created_at = row.created_at.toISOString()
  if (row.updated_at instanceof Date) out.updated_at = row.updated_at.toISOString()
  if (row.mail_envoye_at instanceof Date) out.mail_envoye_at = row.mail_envoye_at.toISOString()
  if (row.sms_envoye_at instanceof Date) out.sms_envoye_at = row.sms_envoye_at.toISOString()
  if (row.video_rendered_at instanceof Date) out.video_rendered_at = row.video_rendered_at.toISOString()
  if (row.video_published_at instanceof Date) out.video_published_at = row.video_published_at.toISOString()
  return out
}

function parseHeurePrevue(s: string): Date | null {
  if (!/^\d{2}:\d{2}/.test(s)) return null
  const [hh, mi] = s.slice(0, 5).split(':').map(Number)
  return new Date(Date.UTC(1970, 0, 1, hh, mi, 0))
}

export async function GET(_req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const id = params.id
  const user = await getSessionUser()
  const access = await assertInterventionAccess(id, user)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const intervention = await prisma.intervention.findUnique({ where: { id } })
    if (!intervention) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

    let client = null
    if (intervention.client_id) {
      client = await prisma.client.findUnique({
        where: { id: intervention.client_id },
        select: { id: true, nom: true, email: true, telephone: true, adresse: true, code_postal: true, ville: true },
      })
    }

    let technicien = null
    if (intervention.technicien_id) {
      technicien = await prisma.technicien.findUnique({
        where: { id: intervention.technicien_id },
        select: { id: true, nom: true, email: true, telephone: true, agence: true },
      })
    }

    const devisDoc = await prisma.document.findFirst({
      where: { intervention_id: id, type: 'devis' },
      select: { id: true },
    })

    return NextResponse.json({
      intervention: serializeIntervention(intervention as unknown as Record<string, unknown>),
      client,
      technicien,
      has_devis: !!devisDoc?.id,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const user = await getSessionUser()
  const access = await assertInterventionAccess(params.id, user)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const TEXT_FIELDS = new Set([
    'agence', 'type_intervention', 'adresse_chantier', 'ville', 'code_postal',
    'date_prevue', 'heure_prevue', 'notes_internes', 'date_realisee',
  ])
  const update: Prisma.InterventionUpdateInput = {}
  for (const [k, v] of Object.entries(body)) {
    if (!UPDATABLE.has(k) || v === undefined) continue
    if (typeof v === 'string' && TEXT_FIELDS.has(k)) {
      const trimmed = v.trim()
      if (k === 'date_prevue' || k === 'date_realisee') {
        update[k] = trimmed === '' ? null : ( /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? new Date(trimmed) : null )
      } else if (k === 'heure_prevue') {
        update.heure_prevue = trimmed === '' ? null : parseHeurePrevue(trimmed)
      } else {
        (update as Record<string, unknown>)[k] = trimmed === '' ? null : trimmed
      }
    } else if (k === 'prix_prevu' && typeof v === 'number') {
      update.prix_prevu = v
    } else {
      (update as Record<string, unknown>)[k] = v
    }
  }

  if (user?.role === 'tech') {
    const techAllowed = new Set(['statut'])
    for (const k of Object.keys(update)) {
      if (!techAllowed.has(k)) delete (update as Record<string, unknown>)[k]
    }
  }

  if (typeof update.statut === 'string' && !ALLOWED_STATUTS.has(update.statut)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  if ('canal_acquisition' in update) {
    const v = update.canal_acquisition
    update.canal_acquisition = (v === null || v === '') ? null : (isCanalAcquisition(v) ? v : null)
  }

  if (update.statut === 'terminee' && !('date_realisee' in update)) {
    update.date_realisee = new Date(new Date().toISOString().slice(0, 10))
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  try {
    const data = await prisma.intervention.update({
      where: { id: params.id },
      data: update,
    })
    return NextResponse.json({ intervention: serializeIntervention(data as unknown as Record<string, unknown>) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const url = new URL(req.url)
  const hard = url.searchParams.get('hard') === '1'

  if (hard) {
    const result = await cascadeDeleteIntervention(params.id)
    if (!result.ok) {
      return NextResponse.json({
        error: 'Échec suppression en cascade',
        warnings: result.warnings,
      }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      hard: true,
      cascade: true,
      deleted_documents: result.deleted_documents,
      deleted_photos: result.deleted_photos,
      deleted_pdfs: result.deleted_pdfs,
      warnings: result.warnings,
    })
  }

  try {
    const data = await prisma.intervention.update({
      where: { id: params.id },
      data: { statut: 'annulee' },
    })
    return NextResponse.json({
      intervention: serializeIntervention(data as unknown as Record<string, unknown>),
      soft: true,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
