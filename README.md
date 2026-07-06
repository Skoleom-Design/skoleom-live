# Skoleom Live — TikTok + Vinted

Plateforme de vente en direct combinant un **feed vidéo/photo** façon TikTok et un **shopping intégré** façon Vinted : chaque post peut porter une ou plusieurs **capsules** (articles achetables) et des **lives** avec achat en un clic, sans jamais rediriger l'utilisateur vers un site externe.

Le projet est un monorepo full-stack : l'API (NestJS) et le front (Next.js) vivent dans le même dépôt et démarrent ensemble via `npm run dev`.

Le paiement (Stripe), le calcul des commissions, l'authentification JWT et le stockage des médias (S3) sont **toujours gérés côté serveur** (`src/server/`). Le front (`src/pages/`, `src/client/`) ne fait qu'orchestrer l'UX et afficher les résultats renvoyés par l'API.

## Sommaire
- [Stack](#stack)
- [Fonctionnalités](#fonctionnalités)
- [Modèle économique](#modèle-économique)
- [Architecture](#architecture)
- [Design system](#design-system)
- [SEO](#seo)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Scripts](#scripts)
- [Routes front](#routes-front)
- [Backend et API](#backend-et-api)
- [Auth](#auth)
- [Feed & Posts](#feed--posts)
- [Capsules (achat intégré)](#capsules-achat-intégré)
- [Boosts (campagnes pub)](#boosts-campagnes-pub)
- [Paiement](#paiement)
- [Admin](#admin)
- [Déploiement](#déploiement)
- [Checklist dev](#checklist-dev)
- [Notes sécurité](#notes-sécurité)
- [Roadmap](#roadmap)
- [Licence](#licence)

## Stack
- **Backend**: NestJS 10 + TypeORM + MySQL
- **Frontend**: Next.js 15 + React 19 + TailwindCSS
- **Paiement**: Stripe
- **Stockage médias**: AWS S3 (URLs présignées)
- **UI**: Radix UI, Framer Motion, lucide-react, Chart.js (stats admin)

Le projet n'utilise pas de design system externe complet : les composants sont construits dans l'app (`src/client/components/`) pour garder une identité Skoleom cohérente.

## Fonctionnalités

### Feed
- Feed paginé de posts (photo/vidéo), public en lecture.
- `PostCard` / `InstaPostCard` pour l'affichage feed.
- Compteurs vues / likes / partages, score de boost par post.

### Capsules
- Articles achetables rattachés à un post (prix, devise, variantes, stock, images).
- Drawer capsule (`CapsuleDrawer`) + checkout Stripe (`CapsuleCheckout`) sans quitter le feed.
- Commission prélevée automatiquement par capsule (`commissionRate`).

### Live
- Page `/live` dédiée au shopping en direct.

### Boosts
- Campagnes publicitaires par post, budget fixe (objectif, budget, durée).
- Suivi impressions / clics / conversions.
- Paiement du boost via Stripe (`BoostModal`, `BoostBadge`).

### Studio
- Espace de création de contenu créateur (`/studio`).

### Admin
- Dashboard stats globales, historique des commissions, campagnes boost, top créateurs.
- Modération des posts (`PATCH /admin/posts/:id/moderate`).
- Protégé par `JwtAuthGuard` + `AdminGuard`.

### Extension navigateur
- Bundles servis statiquement sous `/static` (`content.js`, `background.js`, CSS) — cf. `static/`.

## Modèle économique

| Source       | Mécanisme                                  |
|--------------|---------------------------------------------|
| Commissions  | 15% sur chaque vente de capsule (`COMMISSION_RATE`) |
| Boosts       | Budget fixe au clic, de 5€ à 100€            |

Pas d'abonnement / plan tarifaire pour l'instant : la monétisation repose uniquement sur la commission capsule et les boosts.

## Architecture

```
src/
├── server/                    # NestJS API (port 3000)
│   └── api/
│       ├── auth/                 # JWT (register, login, me)
│       ├── users/
│       ├── posts/                # Feed + analytics créateur
│       ├── capsules/             # Articles achetables
│       ├── orders/                # Commandes issues des capsules
│       ├── boosts/               # Campagnes pub
│       ├── payments/             # Stripe (intents + webhook)
│       ├── files/                # URL upload S3 présignée
│       └── admin/                # Dashboard admin
├── pages/                      # Next.js pages (port 3001)
│   ├── index.tsx                 # Feed principal
│   ├── live.tsx
│   ├── studio/index.tsx
│   ├── post/[id].tsx
│   ├── profile/[id].tsx, profile/me.tsx
│   ├── auth/login.tsx
│   └── admin/                    # index, boosts, commissions
├── client/                     # Composants React
│   └── components/
│       ├── Post/                    # PostCard, InstaPostCard
│       ├── Capsule/                 # CapsuleDrawer, CapsuleCheckout
│       ├── Boost/                   # BoostModal, BoostBadge
│       ├── Feed/                    # Sidebar, VideoShelf
│       ├── Layout/                  # Header, UniverseMegaMenu
│       └── Guide/                   # GuideModal
└── shared/
    └── types/                   # entities.ts, api.ts (types partagés front/back)
```

### Principes
- `src/server/api/*` isole la logique par domaine (feature module NestJS : module + controller + service + entity).
- `src/shared/types/` garde les types alignés entre l'API et le front.
- Le préfixe global d'API est `api` (`app.setGlobalPrefix('api')` dans `main.ts`) : toutes les routes du contrôleur sont donc exposées sous `/api/...`.
- Next.js réécrit les appels `/api/:path*` du front vers `API_URL` (voir `next.config.js`) — pas d'appel direct au port 3000 depuis le front.

## Design system

### Typographie
- **Inter** (`fontFamily.sans`) pour tout le texte et l'UI.

### Couleurs custom (`tailwind.config.js`)
```
brand:   DEFAULT #FF2D55  dark #CC1F3F  light #FF6B81   /* rouge/rose accent principal */
surface: DEFAULT #0A0A0A  card #141414  elevated #1C1C1C /* fond sombre */
```

### Direction visuelle
- Interface **dark only** : pas de toggle dark/light, pas de `ThemeProvider` (`src/pages/_app.tsx` ne fait qu'importer `global.css`).
- Animations custom Tailwind : `slide-up`, `fade-in`, `capsule-ping` (pulse sur les capsules achetables).

## SEO

Aucun dispositif SEO/AI-indexing n'est en place à ce jour :
- pas de `robots.txt`, `sitemap.xml` ni `manifest.json` dans `public/` ;
- `_document.tsx` ne contient pas de meta title/description/OG par défaut ;
- certaines pages utilisent `next/head` au cas par cas, sans composant `Seo` centralisé.

Voir [Roadmap](#roadmap).

## Installation

```bash
# 1. Copier et remplir les variables d'environnement
cp .env.example .env

# 2. Installer les dépendances
npm install

# 3. Créer la base de données MySQL
mysql -u root -e "CREATE DATABASE skoleom_live;"

# 4. Lancer en développement (API :3000 + Front :3001)
npm run dev
```

URLs locales :
- Front : http://localhost:3001
- API : http://localhost:3000/api

## Variables d'environnement

```bash
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_NAME=skoleom_live

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# AWS S3
AWS_REGION=eu-west-3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=skoleom-live
S3_BUCKET_DOMAIN=skoleom-live.s3.amazonaws.com

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Commission rate (0.15 = 15%)
COMMISSION_RATE=0.15

# App
API_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_STRIPE_PK=pk_test_...
NODE_ENV=development
PORT=3000
```

Ne jamais commiter de clé Stripe secrète, JWT secret ou credentials S3/DB — le `.gitignore` exclut déjà `.env`.

## Scripts

```bash
npm run dev          # API (nest --watch) + Front (next dev -p 3001) en parallèle
npm run dev:server   # API seule (port 3000)
npm run dev:client   # Front seul (port 3001)
npm run build        # nest build + next build
npm run start         # node dist/main.js (prod, après build)
npm run lint          # ESLint sur src/**/*.ts(x)
npm run typeorm       # CLI TypeORM (migrations)
```

## Routes front

| Route                  | Description                        |
|-------------------------|-------------------------------------|
| `/`                     | Feed principal                     |
| `/live`                 | Shopping en direct                 |
| `/studio`               | Espace créateur                    |
| `/post/[id]`            | Détail d'un post                   |
| `/profile/[id]`         | Profil public d'un créateur        |
| `/profile/me`           | Mon profil                         |
| `/auth/login`           | Connexion / inscription            |
| `/admin`                | Dashboard admin — stats globales   |
| `/admin/boosts`         | Campagnes boost                    |
| `/admin/commissions`    | Historique commissions             |

## Backend et API

Préfixe global : `/api` (défini dans `src/server/main.ts`). CORS restreint à `FRONTEND_URL` en production, `http://localhost:3001` en dev. `ValidationPipe` global (`transform: true, whitelist: true`).

| Méthode | Route                          | Auth          | Description                  |
|---------|----------------------------------|---------------|-------------------------------|
| POST    | `/api/auth/register`             | Non           | Inscription                   |
| POST    | `/api/auth/login`                | Non           | Connexion                     |
| GET     | `/api/auth/me`                   | JWT           | Utilisateur courant            |
| GET     | `/api/posts/feed`                | Non           | Feed paginé                   |
| GET     | `/api/posts/:id`                 | Non           | Détail d'un post               |
| GET     | `/api/posts/creator/:creatorId`  | Non           | Posts d'un créateur             |
| GET     | `/api/posts/analytics/me`        | JWT           | Analytics du créateur connecté |
| POST    | `/api/posts`                     | JWT           | Publier un post                |
| DELETE  | `/api/posts/:id`                 | JWT           | Supprimer un post               |
| GET     | `/api/capsules/post/:postId`     | Non           | Capsules d'un post              |
| GET     | `/api/capsules/:id`              | Non           | Détail d'une capsule            |
| POST    | `/api/capsules`                  | JWT           | Créer une capsule               |
| PATCH   | `/api/capsules/:id`              | JWT           | Modifier une capsule            |
| DELETE  | `/api/capsules/:id`              | JWT           | Supprimer une capsule           |
| GET     | `/api/boosts/my`                 | JWT           | Mes campagnes boost             |
| POST    | `/api/boosts`                    | JWT           | Créer un boost                  |
| POST    | `/api/payments/capsule/intent`   | JWT           | Paiement capsule (Stripe)       |
| POST    | `/api/payments/boost/intent`     | JWT           | Payer un boost                  |
| POST    | `/api/payments/webhook`          | Signature Stripe | Webhook Stripe               |
| POST    | `/api/files/upload-url`          | JWT           | URL upload S3 présignée         |
| GET     | `/api/admin/stats`               | JWT + Admin   | Dashboard stats                 |
| GET     | `/api/admin/commissions`         | JWT + Admin   | Historique commissions          |
| GET     | `/api/admin/boosts`              | JWT + Admin   | Campagnes boost                 |
| GET     | `/api/admin/top-creators`        | JWT + Admin   | Top créateurs                   |
| PATCH   | `/api/admin/posts/:id/moderate`  | JWT + Admin   | Modération d'un post            |

## Auth

Fichiers principaux : `src/server/api/auth/`.

- JWT via `@nestjs/passport` + `passport-jwt`, mots de passe hashés avec `bcryptjs`.
- `AdminGuard` distinct du `JwtAuthGuard` pour les routes `/api/admin/*`.
- ⚠️ État actuel du front : `src/pages/auth/login.tsx` est encore un **stub** — il simule la connexion (token factice en `localStorage`, clé `skoleom:authToken`) au lieu d'appeler réellement `POST /api/auth/login`. À raccorder au vrai endpoint.

## Feed & Posts

Fichiers principaux : `src/server/api/posts/`, `src/client/components/Post/`, `src/client/components/Feed/`.

- Post = média (`mediaUrl`, `thumbnailUrl`) + caption + tags + type (photo/vidéo) + statut.
- Compteurs `viewCount`, `likeCount`, `shareCount`, `boostScore`, `isBoosted`.
- Chaque post peut porter un ou plusieurs `musicName`/`musicUrl` (façon TikTok) et une ou plusieurs capsules.

## Capsules (achat intégré)

Fichiers principaux : `src/server/api/capsules/`, `src/client/components/Capsule/`.

```
Post avec capsule
  -> CapsuleDrawer (ouverture depuis le feed)
  -> Choix variante / quantité
  -> CapsuleCheckout -> POST /api/payments/capsule/intent
  -> Stripe (paiement in-app, sans redirection)
  -> Order créé (commission + part créateur calculées côté serveur)
```

Champs clés de la capsule : `price`, `currency`, `stock`, `soldCount`, `variants`, `commissionRate`. Le calcul de commission (`Order.commissionAmount` / `Order.creatorAmount`) est **toujours fait côté backend**, jamais dans le front.

## Boosts (campagnes pub)

Fichiers principaux : `src/server/api/boosts/`, `src/client/components/Boost/`.

- Un boost cible un post (`postId`) avec un objectif, un budget (5€–100€) et une durée en jours.
- Paiement via `POST /api/payments/boost/intent` (Stripe), puis suivi `impressions` / `clicks` / `conversions`.
- `BoostBadge` affiche le statut boosté sur un post dans le feed ; `BoostModal` gère la création/paiement.

## Paiement

Le front ne détient jamais la clé secrète Stripe — uniquement `NEXT_PUBLIC_STRIPE_PK` / `STRIPE_PUBLISHABLE_KEY` pour monter Stripe côté client.

```
Front (CapsuleCheckout / BoostModal)
  -> POST /api/payments/capsule/intent | /api/payments/boost/intent
  -> Stripe PaymentIntent créé côté serveur
  -> Confirmation paiement (Stripe.js)
  -> POST /api/payments/webhook (vérifié par signature stripe-signature)
  -> Order / Boost mis à jour côté serveur
```

## Admin

Fichiers principaux : `src/server/api/admin/`, `src/pages/admin/`.

- Toutes les routes `/api/admin/*` sont protégées par `JwtAuthGuard` + `AdminGuard` au niveau du contrôleur.
- Stats globales, historique commissions, campagnes boost, top créateurs, modération de posts.
- Graphiques via Chart.js / react-chartjs-2.

## Déploiement

Pas de workflow CI/CD configuré à ce jour (pas de `.github/workflows/`). Étapes manuelles :

```bash
npm run build   # nest build (API) + next build (front)
npm run start   # sert l'API buildée (dist/main.js) — le front Next doit être servi séparément (next start) ou via un reverse proxy
```

Points à vérifier avant mise en prod :
- `FRONTEND_URL` configuré pour le CORS API ;
- `NODE_ENV=production` (désactive `synchronize` TypeORM — passer par de vraies migrations) ;
- `STRIPE_WEBHOOK_SECRET` pointant vers le bon endpoint webhook déployé ;
- bucket S3 et `S3_BUCKET_DOMAIN` cohérents avec `next.config.js` (`images.domains`).

## Checklist dev

```
1. MySQL lancé et base skoleom_live créée
2. .env rempli (DB, JWT_SECRET, Stripe test keys, AWS S3)
3. npm install
4. npm run dev (API :3000 + Front :3001)
5. Stripe CLI en écoute si test des webhooks : stripe listen --forward-to localhost:3000/api/payments/webhook
```

## Notes sécurité

- Le calcul des commissions et montants créateur (`Order.commissionAmount`, `creatorAmount`) est fait côté backend uniquement.
- Les routes `/api/admin/*` exigent `JwtAuthGuard` **et** `AdminGuard` — ne jamais exposer de logique admin côté front sans double vérification serveur.
- Le webhook Stripe (`/api/payments/webhook`) doit rester la seule route qui valide un paiement — ne jamais faire confiance à une confirmation émise par le front seul.
- Stripe secret key, JWT secret, credentials AWS et DB restent uniquement côté serveur (`.env`, jamais `NEXT_PUBLIC_*`).
- Le login front est actuellement un stub (voir [Auth](#auth)) — ne pas le considérer comme sécurisé tant qu'il n'appelle pas réellement `/api/auth/login`.

## Roadmap

- Connecter réellement `auth/login.tsx` au backend (`/api/auth/login`) et retirer le stub `localStorage`.
- SEO : `robots.txt`, `sitemap.xml`, `manifest.json`, composant `Seo` centralisé (meta/OG/Twitter).
- CI/CD (build + déploiement automatisé).
- Migrations TypeORM (remplacer `synchronize` en prod).
- Vraies pages de paramètres / profil créateur avancé.
- Live shopping temps réel (au-delà de la page statique `/live`).

## Licence

Projet privé Skoleom.
