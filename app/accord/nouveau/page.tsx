import Link from "next/link"
import { redirect } from "next/navigation"
import { getPrismaOrNull } from "@/lib/db"
import type { Tarif } from "@/lib/types"
import { serializeTarif } from "@/lib/types"
import { getParametre } from "@/lib/parametres"
import AccordForm, { type AccordPrefill } from "@/components/accord/AccordForm"
import TechAccordChrome from "@/components/TechAccordChrome"
import { auth } from "@/lib/auth"
import { assertInterventionAccess } from "@/lib/intervention-access"
import { isAccordFinDeMois } from "@/lib/fin-de-mois"

export const dynamic = 'force-dynamic'

async function loadTarifs(): Promise<Tarif[]> {
  const prisma = getPrismaOrNull()
  if (!prisma) return []
  try {
    const rows = await prisma.tarif.findMany({
      where: { actif: true },
      orderBy: { label: 'asc' },
    })
    return rows.map(serializeTarif)
  } catch (e) {
    console.error('[accord/nouveau] loadTarifs', e)
    return []
  }
}

/** Forme minimale d'une fiche client lue pour le pré-remplissage. */
type ClientRow = {
  nom: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  telephone: string | null
  email: string | null
}

/** Pré-remplissage client depuis une intervention existante (rattachement optionnel). */
async function loadPrefill(interventionId: string): Promise<AccordPrefill | null> {
  const prisma = getPrismaOrNull()
  if (!prisma) return null

  try {
    const itvData = await prisma.intervention.findUnique({
      where: { id: interventionId },
      select: {
        adresse_chantier: true,
        ville: true,
        code_postal: true,
        client_id: true,
      },
    })
    if (!itvData) return null

    let client: ClientRow | null = null
    if (itvData.client_id) {
      client = await prisma.client.findUnique({
        where: { id: itvData.client_id },
        select: {
          nom: true,
          adresse: true,
          code_postal: true,
          ville: true,
          telephone: true,
          email: true,
        },
      })
    }

    return {
      client_id: itvData.client_id ?? null,
      client_nom: client?.nom || '',
      client_adresse: client?.adresse || itvData.adresse_chantier || '',
      client_code_postal: client?.code_postal || itvData.code_postal || '',
      client_ville: client?.ville || itvData.ville || '',
      client_telephone: client?.telephone || '',
      client_email: client?.email || '',
    }
  } catch (e) {
    console.error('[accord/nouveau] loadPrefill intervention', e)
    return null
  }
}

export default async function NouvelAccordPage({
  searchParams,
}: {
  searchParams: { intervention?: string }
}) {
  const session = await auth()
  const isTech = session?.user?.role === 'tech'
  if (isTech && !isAccordFinDeMois()) {
    redirect('/planning')
  }

  const interventionParam = searchParams.intervention || null
  if (isTech && interventionParam) {
    const access = await assertInterventionAccess(interventionParam, {
      role: 'tech',
      technicienId: session?.user?.technicienId ?? null,
    })
    if (!access.ok) redirect('/planning')
  }

  const [tarifs, tvaStr, validiteStr, prefill] = await Promise.all([
    loadTarifs(),
    getParametre('TVA_TRAVAUX', '0'),
    getParametre('ACCORD_VALIDITE_JOURS', '30'),
    interventionParam ? loadPrefill(interventionParam) : Promise.resolve(null),
  ])

  // Si le paramètre intervention ne correspond à aucune intervention, on bascule
  // en accord autonome plutôt que de risquer une violation de clé étrangère.
  const interventionId = prefill ? interventionParam : null
  const tauxTVA = Number(tvaStr) || 0
  const validiteJours = Number(validiteStr) || 30

  return (
    <div className="allo-page">
      <TechAccordChrome />
      <header className="bg-[#0e2a52] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-black text-lg sm:text-xl leading-tight">🤝 Nouvel accord</h1>
            <div className="text-[11px] opacity-70">
              {interventionId
                ? 'Devis détaillé · rattaché à une intervention'
                : 'Devis détaillé · accord signé avant travaux'}
            </div>
          </div>
          <Link
            href={isTech ? '/planning' : '/accord'}
            className="text-sm font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition shrink-0"
          >
            {isTech ? '← Planning' : '← Accords'}
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5">
        <AccordForm
          tarifs={tarifs}
          interventionId={interventionId}
          prefill={prefill}
          tauxTVA={tauxTVA}
          validiteJours={validiteJours}
        />
      </main>
    </div>
  )
}
