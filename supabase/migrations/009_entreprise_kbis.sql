-- Identité légale Allo Débouchage — valeurs à renseigner depuis le KBIS
insert into parametres (cle, valeur, description) values
  ('ALLO_SIREN', '', 'SIREN'),
  ('ALLO_SIRET', '', 'SIRET établissement principal'),
  ('ALLO_RCS', '', 'Immatriculation RCS'),
  ('ALLO_TVA_INTRACOM', '', 'N° TVA intracommunautaire'),
  ('ALLO_IBAN', '', 'IBAN virement factures'),
  ('ALLO_BIC', '', 'BIC banque'),
  ('ALLO_RAISON_SOCIALE', 'Allo Débouchage', 'Raison sociale factures')
on conflict (cle) do nothing;
