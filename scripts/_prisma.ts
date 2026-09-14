import { PrismaClient } from '@prisma/client'
import { loadEnvLocal } from './_load-env'

loadEnvLocal()

let client: PrismaClient | null = null

export function getScriptPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL manquante — renseigne-la dans .env.local')
  }
  if (!client) client = new PrismaClient()
  return client
}

export async function disconnectScriptPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect()
    client = null
  }
}
