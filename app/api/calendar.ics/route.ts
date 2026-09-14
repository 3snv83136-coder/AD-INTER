import { NextRequest, NextResponse } from 'next/server'
import { dbNotConfiguredResponse, getPrismaOrNull } from '@/lib/db'
import { getCalendarToken } from '@/lib/calendar-token'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function escapeICS(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function fold(line: string): string {
  const max = 73
  if (line.length <= max) return line
  const parts: string[] = [line.slice(0, max)]
  let i = max
  while (i < line.length) {
    parts.push(' ' + line.slice(i, i + max - 1))
    i += max - 1
  }
  return parts.join('\r\n')
}

function fmtUTCStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function isoDate(d: Date | null): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

function timeStr(d: Date | null): string {
  if (!d) return ''
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const VTIMEZONE_PARIS = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Paris',
  'BEGIN:STANDARD',
  'DTSTART:19701025T030000',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700329T020000',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
].join('\r\n')

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = (url.searchParams.get('token') || '').trim()
  const expected = getCalendarToken()

  if (!expected) {
    return new NextResponse(
      'Calendar feed désactivé : NEXTAUTH_SECRET ou CALENDAR_TOKEN manquant côté serveur.',
      { status: 503 },
    )
  }
  if (!token || token !== expected) {
    return new NextResponse('Token invalide.', { status: 401 })
  }

  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return new NextResponse(err.error, { status: err.status })
  }

  const interventions = await prisma.intervention.findMany({
    where: { date_prevue: { not: null }, flux: "crm" },
    select: {
      id: true,
      reference: true,
      type_intervention: true,
      adresse_chantier: true,
      ville: true,
      code_postal: true,
      date_prevue: true,
      heure_prevue: true,
      duree_estimee_min: true,
      urgence: true,
      statut: true,
      notes_internes: true,
      agence: true,
      client_id: true,
      technicien_id: true,
      updated_at: true,
    },
    orderBy: { date_prevue: 'asc' },
    take: 2000,
  })

  const clientIds = Array.from(new Set(interventions.map(i => i.client_id).filter((v): v is string => !!v)))
  const techIds = Array.from(new Set(interventions.map(i => i.technicien_id).filter((v): v is string => !!v)))

  const [clients, techniciens] = await Promise.all([
    clientIds.length
      ? prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, nom: true, telephone: true, email: true },
        })
      : Promise.resolve([]),
    techIds.length
      ? prisma.technicien.findMany({
          where: { id: { in: techIds } },
          select: { id: true, nom: true, telephone: true },
        })
      : Promise.resolve([]),
  ])

  const clientMap = new Map(clients.map(c => [c.id, c]))
  const techMap = new Map(techniciens.map(t => [t.id, t]))

  const origin = url.origin
  const now = fmtUTCStamp(new Date())

  const lines: string[] = []
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//Allo Débouchage CRM//Interventions//FR')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push('X-WR-CALNAME:Allo Débouchage Interventions')
  lines.push('X-WR-CALDESC:Planning des interventions Allo Débouchage — synchronisé depuis le CRM')
  lines.push('X-WR-TIMEZONE:Europe/Paris')
  lines.push('REFRESH-INTERVAL;VALUE=DURATION:PT15M')
  lines.push('X-PUBLISHED-TTL:PT15M')
  lines.push(VTIMEZONE_PARIS)

  for (const i of interventions) {
    if (!i.date_prevue) continue

    const client = i.client_id ? clientMap.get(i.client_id) : null
    const tech = i.technicien_id ? techMap.get(i.technicien_id) : null

    const summary = [
      i.urgence ? '🚨' : '',
      i.type_intervention || 'Intervention',
      client?.nom ? `— ${client.nom}` : '',
      i.ville ? `(${i.ville})` : '',
    ].filter(Boolean).join(' ').trim()

    const location = [
      i.adresse_chantier,
      [i.code_postal, i.ville].filter(Boolean).join(' '),
    ].filter(Boolean).join(', ')

    const descParts: string[] = []
    descParts.push(`Référence : ${i.reference || i.id.slice(0, 8)}`)
    descParts.push(`Statut : ${i.statut}`)
    if (client?.nom) {
      descParts.push(`Client : ${client.nom}${client.telephone ? ` — ${client.telephone}` : ''}${client.email ? ` — ${client.email}` : ''}`)
    }
    if (tech?.nom) {
      descParts.push(`Technicien : ${tech.nom}${tech.telephone ? ` — ${tech.telephone}` : ''}`)
    }
    if (i.agence) descParts.push(`Agence : ${i.agence}`)
    if (i.notes_internes) descParts.push(`Notes : ${i.notes_internes}`)
    descParts.push('')
    descParts.push(`Fiche : ${origin}/intervention/${i.id}`)
    const description = descParts.join('\n')

    let dtstartLine: string, dtendLine: string
    if (i.heure_prevue) {
      const ymd = isoDate(i.date_prevue).replaceAll('-', '')
      const hm = timeStr(i.heure_prevue).replace(':', '')
      const dtstart = `${ymd}T${hm}00`

      const [y, mo, d] = isoDate(i.date_prevue).split('-').map(Number)
      const [h, m] = timeStr(i.heure_prevue).split(':').map(Number)
      const dur = i.duree_estimee_min ?? 60
      const endTs = new Date(y, mo - 1, d, h, m + dur)
      const ey = endTs.getFullYear()
      const em = String(endTs.getMonth() + 1).padStart(2, '0')
      const ed = String(endTs.getDate()).padStart(2, '0')
      const eh = String(endTs.getHours()).padStart(2, '0')
      const emin = String(endTs.getMinutes()).padStart(2, '0')
      const dtend = `${ey}${em}${ed}T${eh}${emin}00`

      dtstartLine = `DTSTART;TZID=Europe/Paris:${dtstart}`
      dtendLine = `DTEND;TZID=Europe/Paris:${dtend}`
    } else {
      const ymd = isoDate(i.date_prevue).replaceAll('-', '')
      const next = new Date(isoDate(i.date_prevue) + 'T00:00:00Z')
      next.setUTCDate(next.getUTCDate() + 1)
      const nextYmd = next.toISOString().slice(0, 10).replaceAll('-', '')
      dtstartLine = `DTSTART;VALUE=DATE:${ymd}`
      dtendLine = `DTEND;VALUE=DATE:${nextYmd}`
    }

    let icsStatus = 'CONFIRMED'
    if (i.statut === 'annulee') icsStatus = 'CANCELLED'
    else if (i.statut === 'planifiee') icsStatus = 'TENTATIVE'

    let lastMod = now
    if (i.updated_at) {
      try { lastMod = fmtUTCStamp(i.updated_at) } catch { /* ignore */ }
    }

    lines.push('BEGIN:VEVENT')
    lines.push(fold(`UID:intervention-${i.id}@allo`))
    lines.push(fold(`DTSTAMP:${now}`))
    lines.push(fold(`LAST-MODIFIED:${lastMod}`))
    lines.push(fold(dtstartLine))
    lines.push(fold(dtendLine))
    lines.push(fold(`SUMMARY:${escapeICS(summary)}`))
    if (location) lines.push(fold(`LOCATION:${escapeICS(location)}`))
    lines.push(fold(`DESCRIPTION:${escapeICS(description)}`))
    lines.push(fold(`URL:${origin}/intervention/${i.id}`))
    if (i.urgence) lines.push('PRIORITY:1')
    lines.push(`STATUS:${icsStatus}`)
    if (i.type_intervention) lines.push(fold(`CATEGORIES:${escapeICS(i.type_intervention)}`))
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  const ics = lines.join('\r\n') + '\r\n'

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="allo-interventions.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
