import type { EmetteurData } from "@/components/DevisPDF"
import type { Agence } from "@/lib/agences"
import { BRAND_NAME, CONTACT_EMAIL } from "@/lib/brand"
import {
  ALLO_BANK,
  ALLO_FORME_JURIDIQUE,
  ALLO_RCS,
  ALLO_SIRET,
  ALLO_TVA_INTRACOM,
} from "@/lib/entreprise"
import { TEL_PRINCIPAL_FALLBACK } from "@/lib/parametres"

/**
 * Identité émetteur Allo Débouchage partagée par toutes les pages qui génèrent des PDFs.
 * Le téléphone est centralisé dans `lib/parametres.ts`.
 */
export const ALLO_EMETTEUR: EmetteurData = {
  raisonSociale: BRAND_NAME,
  adresseLignes: ["909 Avenue des platanes", "34970 Lattes"],
  telephone: TEL_PRINCIPAL_FALLBACK,
  email: CONTACT_EMAIL,
  rcs: ALLO_RCS,
  capital: ALLO_FORME_JURIDIQUE,
  siret: ALLO_SIRET,
  tva: ALLO_TVA_INTRACOM,
  iban: ALLO_BANK.iban,
  bic: ALLO_BANK.bic,
}

export type FactureEmetteurDataLite = EmetteurData & { agence?: Agence | string }

export function alloFactureEmetteur(agence?: Agence | string, telephone?: string): FactureEmetteurDataLite {
  return {
    ...ALLO_EMETTEUR,
    telephone: telephone?.trim() || ALLO_EMETTEUR.telephone,
    agence: agence || undefined,
  }
}
