-- Rapporteur d'affaires : sous-traitants + flux intervention + tarif commission

create table if not exists sous_traitants (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null,
  email      text,
  telephone  text,
  actif      boolean not null default true,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sous_traitants_actif_idx on sous_traitants (actif);
create index if not exists sous_traitants_nom_idx on sous_traitants (nom);

drop trigger if exists sous_traitants_set_updated_at on sous_traitants;
create trigger sous_traitants_set_updated_at before update on sous_traitants
  for each row execute function set_updated_at();

alter table interventions
  add column if not exists flux text not null default 'crm',
  add column if not exists sous_traitant_id uuid references sous_traitants(id) on delete set null,
  add column if not exists rapporteur_envoye_at timestamptz,
  add column if not exists rapporteur_facture_id uuid;

create index if not exists interventions_flux_idx on interventions (flux);
create index if not exists interventions_sous_traitant_id_idx on interventions (sous_traitant_id);

insert into tarifs (type, label, prix_min, prix_max, unite) values
  ('COMMISSION_RAPPORTEUR', 'Commission rapporteur d''affaires', 75, 75, 'intervention')
on conflict (type) do nothing;
