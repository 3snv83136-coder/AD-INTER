import { getPrisma } from '@/lib/db'
import { ALLO_BANK } from '@/lib/entreprise'

/** Retourne le compte bancaire actif principal (crée Qonto/Allo Débouchage si absent). */
export async function ensureCompteBancairePrincipal(): Promise<string> {
  const prisma = getPrisma()

  const existing = await prisma.compteBancaire.findFirst({
    where: { actif: true },
    orderBy: { created_at: 'asc' },
    select: { id: true },
  })

  if (existing) return existing.id

  const iban = ALLO_BANK.iban.replace(/\s+/g, '')
  const created = await prisma.compteBancaire.create({
    data: {
      banque: 'Qonto',
      iban,
      libelle: 'Compte principal Allo Débouchage',
      solde_initial: 0,
      actif: true,
    },
    select: { id: true },
  })

  return created.id
}
