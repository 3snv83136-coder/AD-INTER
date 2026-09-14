import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, assertInterventionAccess } from "@/lib/intervention-access"
import { getPrismaOrNull, dbNotConfiguredResponse } from "@/lib/db"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

type Action = 'debut' | 'fin' | 'set'

function serializeIntervention(row: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...row }
  for (const key of ['date_prevue', 'date_realisee'] as const) {
    if (row[key] instanceof Date) out[key] = (row[key] as Date).toISOString().slice(0, 10)
  }
  if (row.heure_prevue instanceof Date) {
    const d = row.heure_prevue as Date
    out.heure_prevue = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  }
  for (const key of ['heure_debut_reelle', 'heure_fin_reelle', 'created_at', 'updated_at', 'mail_envoye_at', 'sms_envoye_at', 'video_rendered_at', 'video_published_at'] as const) {
    if (row[key] instanceof Date) out[key] = (row[key] as Date).toISOString()
  }
  if (row.prix_prevu != null) out.prix_prevu = Number(row.prix_prevu)
  return out
}

export async function POST(req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const interventionId = params.id
  if (!interventionId) {
    return NextResponse.json({ error: 'ID intervention manquant' }, { status: 400 })
  }

  const user = await getSessionUser()
  const access = await assertInterventionAccess(interventionId, user)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  let body: { action?: Action; step?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const action = body.action
  if (action !== 'debut' && action !== 'fin' && action !== 'set') {
    return NextResponse.json({ error: 'Action invalide (debut | fin | set)' }, { status: 400 })
  }

  const interv = await prisma.intervention.findUnique({
    where: { id: interventionId },
    select: { id: true, terrain_step: true, statut: true },
  })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  const update: Record<string, unknown> = {}
  const now = new Date()

  if (action === 'debut') {
    update.heure_debut_reelle = now
    update.statut = 'en_cours'
    if ((interv.terrain_step ?? 0) < 2) update.terrain_step = 2
  } else if (action === 'fin') {
    update.heure_fin_reelle = now
    update.statut = 'terminee'
    update.date_realisee = new Date(now.toISOString().slice(0, 10))
  } else if (action === 'set') {
    const step = Number(body.step)
    if (!Number.isInteger(step) || step < 0 || step > 8) {
      return NextResponse.json({ error: 'step doit être un entier entre 0 et 8' }, { status: 400 })
    }
    update.terrain_step = step
  }

  try {
    const data = await prisma.intervention.update({
      where: { id: interventionId },
      data: update,
    })
    return NextResponse.json({ intervention: serializeIntervention(data as unknown as Record<string, unknown>) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
