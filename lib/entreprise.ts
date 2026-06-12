/**
 * Identité légale Allo Débouchage — valeurs lues depuis les variables d'environnement.
 * Renseigner ALLO_SIREN, ALLO_SIRET, etc. dans .env.local / Vercel.
 */

export const ALLO_SIREN = process.env.ALLO_SIREN || ""

/** Siège social — 909 Avenue des platanes, 34970 Lattes */
export const ALLO_SIRET = process.env.ALLO_SIRET || process.env.NEXT_PUBLIC_ALLO_SIRET || ""

export const ALLO_RCS = process.env.ALLO_RCS || ""

export const ALLO_TVA_INTRACOM = process.env.ALLO_TVA_INTRACOM || ""

export const ALLO_FORME_JURIDIQUE = process.env.ALLO_FORME_JURIDIQUE || "Société"

export const ALLO_BANK = {
  iban: process.env.ALLO_IBAN || "",
  bic: process.env.ALLO_BIC || "",
} as const

/** Mentions obligatoires facture B2B (pénalités, indemnité 40 €). */
export const FACTURE_MENTIONS_LEGALES = [
  "En cas de retard de paiement, application d'une pénalité au taux de 3 fois le taux d'intérêt légal en vigueur.",
  "Indemnité forfaitaire pour frais de recouvrement due au créancier en cas de retard de paiement : 40 € (art. L.441-10 et D.441-5 du code de commerce).",
  "Pas d'escompte accordé en cas de paiement anticipé.",
].join(" ")
