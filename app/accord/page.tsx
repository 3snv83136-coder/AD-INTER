import Link from "next/link"
import { redirect } from "next/navigation"
import { getPrismaOrNull } from "@/lib/db"
import type { AccordIntervention, AccordStatut } from "@/lib/types"
import { serializeAccordIntervention } from "@/lib/types"
import { fmtDateFR, fmtEUR } from "@/lib/format"
import StatutSyncBadge from "@/components/accord/StatutSyncBadge"
import TechAccordChrome from "@/components/TechAccordChrome"
import { auth } from "@/lib/auth"
import { isAccordFinDeMois } from "@/lib/fin-de-mois"

// Outil d'admin : la liste doit toujours être fraîche (pas de cache).
export const dynamic = 'force-dynamic'

const STATUT_LABEL: Record<AccordStatut, string> = {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_SMS: 'En attente SMS',
  VALIDE: 'Validé',
  REFUSE: 'Refusé',
  ANNULE: 'Annulé',
}

const STATUT_BADGE: Record<AccordStatut, string> = {
  BROUILLON: 'bg-slate-100 text-slate-600',
  EN_ATTENTE_SMS: 'bg-amber-100 text-amber-700',
  VALIDE: 'bg-emerald-100 text-emerald-700',
  REFUSE: 'bg-red-100 text-red-700',
  ANNULE: 'bg-slate-200 text-slate-500',
}

type LoadResult = {
  accords: AccordIntervention[]
  error: string | null
  needsMigration: boolean
}

async function loadAccords(technicienId: string | null): Promise<LoadResult> {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    return { accords: [], error: 'Base de données non configurée (DATABASE_URL manquante).', needsMigration: false }
  }

  try {
    const data = technicienId
      ? await prisma.accordIntervention.findMany({
          where: { intervention: { technicien_id: technicienId } },
          orderBy: { created_at: 'desc' },
          take: 200,
        })
      : await prisma.accordIntervention.findMany({
          orderBy: { created_at: 'desc' },
          take: 200,
        })
    return { accords: data.map(serializeAccordIntervention), error: null, needsMigration: false }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur de chargement'
    const needsMigration = /accords_intervention|does not exist|P2021/.test(message)
    return { accords: [], error: message, needsMigration }
  }
}

export default async function AccordHubPage() {
  const session = await auth()
  const isTech = session?.user?.role === 'tech'
  if (isTech && !isAccordFinDeMois()) {
    redirect('/planning')
  }

  const technicienId = isTech ? (session?.user?.technicienId ?? null) : null
  const { accords, error, needsMigration } = await loadAccords(technicienId)

  return (
    <div className="allo-page pb-20">
      <TechAccordChrome />
      <header className="bg-[#0e2a52] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-black text-lg sm:text-xl leading-tight">🤝 Accord d&apos;intervention</h1>
            <div className="text-[11px] opacity-70">
              {isTech ? 'Fin de mois — vos accords' : 'Devis + accord signé avant travaux'}
            </div>
          </div>
          <Link
            href={isTech ? '/planning' : '/'}
            className="text-sm font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition shrink-0"
          >
            {isTech ? '← Planning' : '← Accueil'}
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        <StatutSyncBadge />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">
            {accords.length > 0 ? `${accords.length} accord${accords.length > 1 ? 's' : ''}` : 'Aucun accord'}
          </div>
          <Link
            href="/accord/nouveau"
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm transition"
          >
            + Nouvel accord
          </Link>
        </div>

        {needsMigration && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm">
            <div className="font-bold mb-1">⚠ Base de données non initialisée</div>
            Exécute les migrations Prisma (<code className="font-mono">npx prisma migrate deploy</code>){' '}
            pour activer le module.
          </div>
        )}

        {error && !needsMigration && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
            Erreur de chargement : {error}
          </div>
        )}

        {!error && accords.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
            <div className="text-5xl mb-3">🤝</div>
            <div className="font-bold text-slate-800">Aucun accord pour le moment</div>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Crée un accord à l&apos;arrivée chez le client : devis détaillé, demande expresse
              d&apos;intervention urgente et information sur le droit de rétractation, validé sur place.
            </p>
            <Link
              href="/accord/nouveau"
              className="inline-block mt-5 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-sm transition"
            >
              + Créer le premier accord
            </Link>
          </div>
        )}

        {accords.length > 0 && (
          <ul className="space-y-2">
            {accords.map(a => {
              const statut = a.statut as AccordStatut
              return (
                <li key={a.id}>
                  <Link
                    href={`/accord/${a.id}`}
                    className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 hover:border-slate-300 hover:shadow transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 truncate">
                          {a.client_nom || 'Client sans nom'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_BADGE[statut]}`}>
                          {STATUT_LABEL[statut]}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {a.reference || a.id.slice(0, 8)}
                        {a.client_ville ? ` · ${a.client_ville}` : ''}
                        {` · ${fmtDateFR(a.created_at)}`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-slate-800">{fmtEUR(a.total_ttc)}</div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
