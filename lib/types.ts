/**
 * Types métier partagés — source unique pour l'app.
 */

import type {
  AccordIntervention as PrismaAccordIntervention,
  LigneDevis as PrismaLigneDevis,
  Tarif as PrismaTarif,
} from '@prisma/client'

export type {
  Client,
  Technicien,
  Intervention,
  Document,
  FactureFournisseur,
  Parametre,
  CompteBancaire,
  OperationBancaire,
  ReleveBancaire,
  PreBilan,
  SocialToken,
} from '@prisma/client'

export type Statut = 'planifiee' | 'en_cours' | 'terminee' | 'annulee'

export type DocumentType = 'facture' | 'devis' | 'attestation' | 'rapport'

export type DocumentStatut =
  | 'brouillon' | 'envoye' | 'paye' | 'annule'
  | 'accepte' | 'refuse' | 'expire'

export type AccordStatut =
  | 'BROUILLON' | 'EN_ATTENTE_SMS' | 'VALIDE' | 'REFUSE' | 'ANNULE'

export type CanalValidation = 'SIGNATURE' | 'SMS'

export type RapportJson = Record<string, unknown>
export type SeoJson = Record<string, unknown>
export type DocumentPayload = Record<string, unknown>

/** Catalogue des prix — valeurs sérialisées (number / ISO string). */
export interface Tarif {
  id: string
  type: string
  label: string
  prix_min: number
  prix_max: number
  unite: string
  actif: boolean
  created_at: string
  updated_at: string
}

/** Ligne de devis : valeurs gelées au moment de l'accord. */
export interface LigneDevis {
  id: string
  accord_id: string
  tarif_type: string | null
  label: string
  prix_unitaire: number
  unite: string
  quantite: number
  total_ligne: number
  urgent: boolean
  position: number
  created_at: string
}

/** Accord d'intervention signé avant travaux. */
export interface AccordIntervention {
  id: string
  reference: string | null
  intervention_id: string | null
  client_id: string | null
  client_nom: string
  client_adresse: string | null
  client_ville: string | null
  client_code_postal: string | null
  client_telephone: string | null
  client_email: string | null
  frais_deplacement: number
  total_ht: number
  taux_tva: number
  total_tva: number
  total_ttc: number
  devis_gratuit: boolean
  validite_jours: number
  intervention_urgente: boolean
  demande_expresse: boolean
  renonciation_retractation: boolean
  a_travaux_non_urgents: boolean
  canal_validation: string | null
  signature_image: string | null
  sms_token: string | null
  sms_envoye_at: string | null
  valide_at: string | null
  statut: string
  motif_refus: string | null
  pdf_url: string | null
  ip_client: string | null
  user_agent: string | null
  copie_envoyee_at: string | null
  local_id: string | null
  synced_at: string | null
  created_at: string
  updated_at: string
}

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null
  return d instanceof Date ? d.toISOString() : String(d)
}

function toNum(v: { toString(): string } | number | null | undefined): number {
  if (v == null) return 0
  return typeof v === 'number' ? v : Number(v)
}

export function serializeTarif(t: PrismaTarif): Tarif {
  return {
    ...t,
    prix_min: toNum(t.prix_min),
    prix_max: toNum(t.prix_max),
    created_at: toIso(t.created_at) ?? '',
    updated_at: toIso(t.updated_at) ?? '',
  }
}

export function serializeLigneDevis(l: PrismaLigneDevis): LigneDevis {
  return {
    ...l,
    prix_unitaire: toNum(l.prix_unitaire),
    quantite: toNum(l.quantite),
    total_ligne: toNum(l.total_ligne),
    created_at: toIso(l.created_at) ?? '',
  }
}

export function serializeAccordIntervention(a: PrismaAccordIntervention): AccordIntervention {
  return {
    ...a,
    frais_deplacement: toNum(a.frais_deplacement),
    total_ht: toNum(a.total_ht),
    taux_tva: toNum(a.taux_tva),
    total_tva: toNum(a.total_tva),
    total_ttc: toNum(a.total_ttc),
    sms_envoye_at: toIso(a.sms_envoye_at),
    valide_at: toIso(a.valide_at),
    copie_envoyee_at: toIso(a.copie_envoyee_at),
    synced_at: toIso(a.synced_at),
    created_at: toIso(a.created_at) ?? '',
    updated_at: toIso(a.updated_at) ?? '',
  }
}
