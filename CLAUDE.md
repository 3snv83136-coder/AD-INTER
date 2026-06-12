# Projet Allo Débouchage

## Identité

- **Nom commercial** : Allo Débouchage
- **Site** : allodebouchage.com
- **Métier** : Débouchage de canalisations, assainissement, plomberie d'urgence
- **Zone** : France (réseau national)
- **Téléphone** : 0 805 55 35 55 (ligne directe)
- **Propriétaire** : MONDOR

## Règles ABSOLUES (jamais violer)

1. **Téléphone** : toujours lire depuis `parametres.TEL_PRINCIPAL`, JAMAIS hardcodé (repli : `lib/parametres.ts`)
2. **Prix** : toujours lire depuis la table `Tarif`, JAMAIS hardcodé ni inventé
3. **Nom commercial** : toujours "Allo Débouchage" en entier sur toute façade client
4. **Aucune référence** à Les Techniciens du Débouchage, LTDB ou lestechniciensdudebouchage.fr

## Stack

Next.js 14 App Router, TypeScript strict, Tailwind CSS, Supabase, Vercel, Resend, Remotion, @react-pdf/renderer.

## Style code

- TypeScript strict, jamais de `any`
- Server Components par défaut, Client Components seulement si interactif
- Tailwind utility classes, jamais de CSS inline sauf cas exceptionnel
- Erreurs gérées avec try/catch, jamais ignorées silencieusement
