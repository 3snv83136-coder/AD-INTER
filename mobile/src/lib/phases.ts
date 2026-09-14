export const TERRAIN_PHASES = [
  { key: 0, label: 'Arrivée', icon: '📍' },
  { key: 1, label: 'Chantier', icon: '🔧' },
  { key: 2, label: 'Clôture', icon: '🎤' },
  { key: 3, label: 'Client', icon: '✉' },
] as const

export function stepToPhase(step: number): number {
  if (step <= 1) return 0
  if (step === 2) return 1
  if (step <= 4) return 2
  return 3
}

export function phaseCta(step: number): string {
  const p = stepToPhase(step)
  if (p === 0) return 'Commencer'
  if (p === 1) return 'Continuer chantier'
  if (p === 2) return 'Clôturer'
  return 'Envoyer client'
}

export const STATUT_LABEL: Record<string, string> = {
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
}
