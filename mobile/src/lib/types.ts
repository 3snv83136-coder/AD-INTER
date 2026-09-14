export type AuthRole = 'admin' | 'tech'

export type AuthUser = {
  login: string
  role: AuthRole
  technicienId: string | null
}

export type Statut = 'planifiee' | 'en_cours' | 'terminee' | 'annulee'

export type InterventionRow = {
  id: string
  reference: string | null
  type_intervention: string | null
  adresse_chantier: string | null
  ville: string | null
  code_postal: string | null
  date_prevue: string | null
  heure_prevue: string | null
  urgence: boolean
  statut: Statut
  terrain_step: number | null
  client_nom: string | null
  client_email: string | null
  client_telephone: string | null
  notes_internes: string | null
}

export type InterventionDetail = {
  id: string
  reference: string | null
  type_intervention: string | null
  adresse_chantier: string | null
  ville: string | null
  code_postal: string | null
  date_prevue: string | null
  heure_prevue: string | null
  statut: Statut
  terrain_step: number
  heure_debut_reelle: string | null
  heure_fin_reelle: string | null
  mail_envoye_at: string | null
  sms_envoye_at: string | null
  photos_urls: string[] | null
  photos_legendes: string[] | null
  pdf_rapport_url: string | null
  rapport_json: Record<string, unknown> | null
  notes_internes: string | null
}

export type ClientDetail = {
  id: string
  nom: string | null
  email: string | null
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
}

export type RapportPreview = {
  diagnostic?: string
  travaux_realises?: string
  recommandations?: string
  commentaire_technicien?: string
  objet?: string
}

export type SeoPreview = {
  titre_h1?: string
}
