import { getPrismaOrNull } from "@/lib/db"

export const TEL_PRINCIPAL_FALLBACK = '0 805 55 35 55'

export async function getParametre(cle: string, fallback = ''): Promise<string> {
  try {
    const prisma = getPrismaOrNull()
    if (!prisma) return fallback
    const row = await prisma.parametre.findUnique({
      where: { cle },
      select: { valeur: true },
    })
    return row?.valeur?.trim() || fallback
  } catch {
    return fallback
  }
}

export function getTelPrincipal(): Promise<string> {
  return getParametre('TEL_PRINCIPAL', TEL_PRINCIPAL_FALLBACK)
}

export function getEmailComptable(): Promise<string> {
  return getParametre('EMAIL_COMPTABLE', process.env.EMAIL_COMPTABLE || '')
}

export function getComptaAlertEmail(): Promise<string> {
  const fallback = process.env.COMPTA_ALERT_EMAIL || process.env.EMAIL_COMPTABLE || ''
  return getParametre('COMPTA_ALERT_EMAIL', fallback)
}
