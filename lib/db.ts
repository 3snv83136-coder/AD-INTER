import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/** Vercel n'enlève pas les guillemets collés depuis .env.local. */
function sanitizeDbEnv(): void {
  for (const key of ['DATABASE_URL', 'DIRECT_URL'] as const) {
    const raw = process.env[key]
    if (!raw) continue
    let v = raw.trim().replace(/^["']|["']$/g, '')
    v = v.replace(new RegExp(`^${key}=`, 'i'), '').trim().replace(/^["']|["']$/g, '')
    if (v !== raw) process.env[key] = v
  }
}

sanitizeDbEnv()

function createClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

/** Client Prisma server-side — NE JAMAIS importer dans un composant client. */
export function getPrisma(): PrismaClient {
  sanitizeDbEnv()
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL non configurée')
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient()
  }
  return globalForPrisma.prisma
}

/** Renvoie null si DATABASE_URL est absente (mode dégradé). */
export function getPrismaOrNull(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null
  return getPrisma()
}

export function dbNotConfiguredResponse() {
  return {
    error: 'Base de données non configurée (DATABASE_URL manquante)',
    status: 503 as const,
  }
}
