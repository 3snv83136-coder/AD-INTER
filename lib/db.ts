import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

/** Client Prisma server-side — NE JAMAIS importer dans un composant client. */
export function getPrisma(): PrismaClient {
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
