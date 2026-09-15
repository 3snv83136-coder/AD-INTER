export const FLUX_CRM = "crm"
export const FLUX_RAPPORTEUR = "rapporteur"

export function isRapporteurFlux(v: unknown): boolean {
  return v === FLUX_RAPPORTEUR
}

/** Super-admin : on peut effacer une affaire ouverte, pas une affaire déjà facturée. */
export function canDeleteAffaireRapporteur(statut: string | null | undefined): boolean {
  return statut !== "terminee"
}
