import type { PrismaClient } from "@prisma/client"
import type { AuthRole } from "@/lib/auth-users"

export const PRESENCE_ONLINE_MS = 90_000
export const PRESENCE_RECENT_MS = 24 * 60 * 60 * 1000

export function roleLabel(role: string): string {
  if (role === "admin") return "Super admin"
  if (role === "operateur") return "Opérateur"
  if (role === "tech") return "Technicien"
  return role
}

export function presenceDisplayName(input: {
  role?: AuthRole | string | null
  accessLabel?: string | null
  login?: string | null
}): string {
  const label = (input.accessLabel || input.login || "").trim()
  const role = roleLabel(input.role || "")
  if (label && role) return `${role} · ${label}`
  return label || role || "Session"
}

let presencesTableReady = false

export async function ensurePresencesTable(prisma: PrismaClient): Promise<void> {
  if (presencesTableReady) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS presences (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_key text NOT NULL UNIQUE,
      login       text NOT NULL,
      role        text NOT NULL,
      label       text NOT NULL,
      path        text,
      last_seen   timestamptz NOT NULL DEFAULT now()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS presences_last_seen_idx ON presences (last_seen DESC)
  `)
  presencesTableReady = true
}

export function formatSeenAgo(lastSeen: Date, now: Date): string {
  const delta = Math.max(0, now.getTime() - lastSeen.getTime())
  const seconds = Math.round(delta / 1000)
  if (seconds < 20) return "à l’instant"
  if (seconds < 60) return `il y a ${seconds} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  return lastSeen.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}
