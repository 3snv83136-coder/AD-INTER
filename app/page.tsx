'use client'

import Link from "next/link"
import { BRAND_NAME } from "@/lib/brand"
import { CrmSignatureSignal } from "@/components/crm/CrmSignatureSignal"

export default function HubPage() {
  return (
    <main className="min-h-dvh bg-[#0a1628] text-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 gap-10">
        <div className="w-full max-w-3xl empty:hidden">
          <CrmSignatureSignal tone="dark" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-xl sm:text-2xl font-black leading-tight">
            {BRAND_NAME}
          </h1>
        </div>

        <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/crm"
            className="group rounded-3xl bg-gradient-to-br from-blue-500 to-blue-800 p-6 sm:p-8 min-h-[200px] flex flex-col justify-between ring-1 ring-white/15 shadow-xl transition hover:scale-[1.02] hover:shadow-2xl"
          >
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-bold text-white/70">Espace</div>
              <h2 className="mt-2 text-2xl sm:text-3xl font-black leading-tight">Allo CRM</h2>
              <p className="mt-3 text-sm text-white/85 leading-relaxed">
                Planning, terrain, devis, factures — l’outil interne Allo Débouchage.
              </p>
            </div>
            <span className="mt-6 text-sm font-bold text-white/90 group-hover:underline">
              Ouvrir les modules →
            </span>
          </Link>

          <Link
            href="/rapporteur"
            className="group rounded-3xl bg-gradient-to-br from-amber-500 to-orange-700 p-6 sm:p-8 min-h-[200px] flex flex-col justify-between ring-1 ring-white/15 shadow-xl transition hover:scale-[1.02] hover:shadow-2xl"
          >
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-bold text-white/70">Espace</div>
              <h2 className="mt-2 text-2xl sm:text-3xl font-black leading-tight">
                Allo Rapporteur d’affaires
              </h2>
              <p className="mt-3 text-sm text-white/85 leading-relaxed">
                Prise d’interventions confiées à des sous-traitants. Envoi direct, puis facture de commission à la clôture.
              </p>
            </div>
            <span className="mt-6 text-sm font-bold text-white/90 group-hover:underline">
              Ouvrir le rapporteur →
            </span>
          </Link>
        </div>
      </div>
    </main>
  )
}
