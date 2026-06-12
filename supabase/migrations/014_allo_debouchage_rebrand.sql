-- Rebrand Allo Débouchage — mise à jour des paramètres entreprise et téléphone

insert into parametres (cle, valeur, description) values
  ('TEL_PRINCIPAL', '0 805 55 35 55', 'Ligne directe Allo Débouchage'),
  ('ALLO_RAISON_SOCIALE', 'Allo Débouchage', 'Raison sociale factures'),
  ('ALLO_SIREN', '', 'SIREN — à renseigner depuis le KBIS'),
  ('ALLO_SIRET', '', 'SIRET — à renseigner depuis le KBIS'),
  ('ALLO_RCS', '', 'Immatriculation RCS'),
  ('ALLO_TVA_INTRACOM', '', 'N° TVA intracommunautaire'),
  ('ALLO_IBAN', '', 'IBAN virement factures'),
  ('ALLO_BIC', '', 'BIC banque')
on conflict (cle) do update set
  valeur = excluded.valeur,
  description = excluded.description;

-- Suppression des clés héritées de l'ancien projet
delete from parametres where cle like 'LTDB_%';
