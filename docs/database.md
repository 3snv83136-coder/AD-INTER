# Base de données — Allo Débouchage CRM

## Stack

- **PostgreSQL** via Prisma (`DATABASE_URL`)
- **Vercel Blob** pour les fichiers (`BLOB_READ_WRITE_TOKEN`)

## 1. Créer la base (Vercel Postgres ou Neon)

### Vercel (recommandé)

1. Dashboard Vercel → projet `ad-inter` → **Storage** → **Postgres** → Create
2. Copier `DATABASE_URL` dans les variables d'environnement
3. Storage → **Blob** → Create → copier `BLOB_READ_WRITE_TOKEN`

### Neon (alternative)

1. [neon.tech](https://neon.tech) → nouveau projet `allo-crm` → région EU
2. Connection string → `DATABASE_URL`

## 2. Appliquer le schéma

```bash
# Local
cp .env.local.example .env.local
# Renseigner DATABASE_URL

npx prisma migrate deploy
```

La migration initiale est dans `prisma/migrations/20260715120000_init/migration.sql` (consolidée depuis l'ancien dossier `supabase/`).

## 3. Variables d'environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Connexion PostgreSQL (Prisma) |
| `BLOB_READ_WRITE_TOKEN` | Token Vercel Blob (upload PDF/photos/vidéos) |

Sur Vercel : Settings → Environment Variables → Production + Preview + Development.

## 4. Commandes utiles

```bash
npx prisma generate      # Régénère le client après changement de schéma
npx prisma migrate deploy # Applique les migrations en prod
npx prisma studio        # UI d'exploration des données
```

## 5. Chemins Blob

| Type | Chemin |
|------|--------|
| PDF intervention | `pdfs/{interventionId}/{fichier}.pdf` |
| Photo terrain | `photos/{interventionId}/{fichier}.jpg` |
| Vidéo Remotion | `videos/{interventionId}/{fichier}.mp4` |
| PDF accord | `accords/{accordId}.pdf` |
| Relevé bancaire | `releves/{compteId}/{annee}-{mois}.pdf` |

## 6. Migration depuis Supabase (données existantes)

1. `pg_dump` de l'ancienne base Supabase (tables publiques uniquement)
2. Restore sur Neon/Vercel Postgres
3. Re-upload des fichiers Storage vers Vercel Blob (script `scripts/migrate-supabase-storage-to-blob.ts` si besoin)

## Schéma SQL de référence

Les fichiers historiques restent dans `supabase/` pour documentation. La source de vérité Prisma est `prisma/schema.prisma`.
