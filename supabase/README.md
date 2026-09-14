# Setup base de données — Allo Débouchage CRM

> **Migration Prisma** : la procédure à jour est dans [docs/database.md](../docs/database.md).

Ce dossier conserve les migrations SQL historiques (référence).  
La migration Prisma initiale est dans `prisma/migrations/20260715120000_init/`.

## Résumé rapide

1. Créer **Vercel Postgres** + **Vercel Blob** sur le projet `ad-inter`
2. Configurer `DATABASE_URL` et `BLOB_READ_WRITE_TOKEN`
3. `npx prisma migrate deploy`
