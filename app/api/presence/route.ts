import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { dbNotConfiguredResponse, getPrismaOrNull } from "@/lib/db"
import { isFullAdmin } from "@/lib/permissions"
import {
  PRESENCE_ONLINE_MS,
  PRESENCE_RECENT_MS,
  ensurePresencesTable,
  formatSeenAgo,
  presenceDisplayName,
  roleLabel,
} from "@/lib/presence"

export const dynamic = "force-dynamic"

const PATH_MAX = 180

type PresenceRow = {
  id: string
  login: string
  role: string
  label: string
  path: string | null
  last_seen: Date
}

function sanitizePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const path = raw.trim()
  if (!path.startsWith("/")) return null
  return path.slice(0, PATH_MAX)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const user = session?.user
  if (!user?.role) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  let path: string | null = null
  try {
    const body = await req.json() as { path?: unknown }
    path = sanitizePath(body.path)
  } catch {
    path = null
  }

  const sessionKey = [user.role, user.accessLabel || user.id || user.name || "session"]
    .filter(Boolean)
    .join(":")
  const login = (user.name || user.accessLabel || "session").trim()
  const label = presenceDisplayName({
    role: user.role,
    accessLabel: user.accessLabel,
    login: user.name,
  })
  const role = user.role

  try {
    await ensurePresencesTable(prisma)
    await prisma.$executeRaw`
      INSERT INTO presences (session_key, login, role, label, path, last_seen)
      VALUES (${sessionKey}, ${login}, ${role}, ${label}, ${path}, now())
      ON CONFLICT (session_key) DO UPDATE SET
        login = EXCLUDED.login,
        role = EXCLUDED.role,
        label = EXCLUDED.label,
        path = EXCLUDED.path,
        last_seen = now()
    `
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur base de données"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }
  if (!isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Réservé au super administrateur" }, { status: 403 })
  }

  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error, sessions: [] }, { status })
  }

  const now = new Date()
  const since = new Date(now.getTime() - PRESENCE_RECENT_MS)

  try {
    await ensurePresencesTable(prisma)
    const rows = await prisma.$queryRaw<PresenceRow[]>`
      SELECT id::text, login, role, label, path, last_seen
      FROM presences
      WHERE last_seen >= ${since}
      ORDER BY last_seen DESC
    `

    const sessions = rows.map((row) => {
      const lastSeen = row.last_seen instanceof Date ? row.last_seen : new Date(row.last_seen)
      const online = now.getTime() - lastSeen.getTime() <= PRESENCE_ONLINE_MS
      return {
        id: row.id,
        login: row.login,
        role: row.role,
        role_label: roleLabel(row.role),
        label: row.label,
        path: row.path,
        last_seen: lastSeen.toISOString(),
        online,
        seen_ago: formatSeenAgo(lastSeen, now),
      }
    })

    sessions.sort((a, b) => Number(b.online) - Number(a.online) || b.last_seen.localeCompare(a.last_seen))

    return NextResponse.json({
      now: now.toISOString(),
      online_count: sessions.filter((s) => s.online).length,
      sessions,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur base de données"
    return NextResponse.json({ error: msg, sessions: [] }, { status: 500 })
  }
}
