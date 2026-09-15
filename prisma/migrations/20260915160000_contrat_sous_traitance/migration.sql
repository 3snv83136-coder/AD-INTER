-- Contrat de sous-traitance signé (CGU + signature) — un par intervention rapporteur

create table if not exists contrats_sous_traitance (
  id               uuid primary key default gen_random_uuid(),
  intervention_id  uuid not null unique references interventions(id) on delete cascade,
  sous_traitant_id uuid not null references sous_traitants(id) on delete restrict,
  cgu_version      text not null,
  cgu_acceptees_at timestamptz not null,
  signature_url    text not null,
  pdf_url          text not null,
  preuve_hash      text not null,
  assurance_numero text not null,
  siret            text,
  signataire_nom   text not null,
  ip               text,
  user_agent       text,
  created_at       timestamptz not null default now()
);

create index if not exists contrats_sous_traitance_st_idx on contrats_sous_traitance (sous_traitant_id);
create index if not exists contrats_sous_traitance_created_idx on contrats_sous_traitance (created_at);
