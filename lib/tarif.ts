import { getPrismaOrNull } from "@/lib/db"
import { serializeTarif, type Tarif } from "@/lib/types"

export const TARIF_COMMISSION_RAPPORTEUR = "COMMISSION_RAPPORTEUR"

export async function getTarifActif(type: string): Promise<Tarif | null> {
  const prisma = getPrismaOrNull()
  if (!prisma) return null
  try {
    const row = await prisma.tarif.findFirst({
      where: { type, actif: true },
    })
    return row ? serializeTarif(row) : null
  } catch (e) {
    console.error("[getTarifActif]", type, e)
    return null
  }
}
