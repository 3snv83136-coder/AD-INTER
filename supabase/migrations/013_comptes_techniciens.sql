-- Comptes techniciens gérés en base (À l'eau Débouchage)
-- Permet à l'admin de créer/gérer les ~15 comptes terrain depuis l'application,
-- en remplacement des variables d'environnement AUTH_TECH_N historique.

alter table techniciens
  add column if not exists login text,
  add column if not exists password_hash text,
  add column if not exists role text not null default 'tech'
    check (role in ('tech', 'admin')),
  add column if not exists doit_changer_mdp boolean not null default true,
  add column if not exists derniere_connexion timestamptz;

-- Login unique (insensible à la casse), null toléré pour les fiches techniciens
-- historiques sans accès applicatif.
create unique index if not exists techniciens_login_unique
  on techniciens (lower(login))
  where login is not null;

comment on column techniciens.login is 'Identifiant de connexion (unique, insensible à la casse)';
comment on column techniciens.password_hash is 'Hash bcrypt du mot de passe';
comment on column techniciens.role is 'tech = mode terrain uniquement, admin = accès complet';
comment on column techniciens.doit_changer_mdp is 'Force le changement de mot de passe à la première connexion';
