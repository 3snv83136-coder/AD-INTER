import RapporteurApp from "@/components/rapporteur/RapporteurApp"
import { TARIF_COMMISSION_RAPPORTEUR, getTarifActif } from "@/lib/tarif"
import { BRAND_NAME } from "@/lib/brand"

export const dynamic = "force-dynamic"

export default async function RapporteurPage() {
  const tarif = await getTarifActif(TARIF_COMMISSION_RAPPORTEUR)

  if (!tarif) {
    return (
      <main className="min-h-dvh bg-[#0a1628] text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-black">{BRAND_NAME}</h1>
          <p className="text-white/70 text-sm">
            Tarif commission rapporteur introuvable : la base n’est pas joignable
            ou la ligne <code className="text-amber-300">{TARIF_COMMISSION_RAPPORTEUR}</code> manque.
            Recharge après correction.
          </p>
        </div>
      </main>
    )
  }

  return <RapporteurApp tarif={tarif} />
}
