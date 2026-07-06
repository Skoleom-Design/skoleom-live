# skoleomLive v2

TikTok + Vinted — feed vidéo/photo avec capsules achetables.

## Stack
- **Backend**: NestJS + TypeORM + MySQL
- **Frontend**: Next.js + React + TailwindCSS
- **Paiement**: Stripe
- **Stockage**: AWS S3

## Démarrage

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

## Architecture

```
src/
├── server/          # NestJS API (port 3000)
│   └── api/
│       ├── auth/         # JWT auth
│       ├── posts/        # Feed TikTok-like
│       ├── capsules/     # Articles achetables
│       ├── orders/       # Commandes
│       ├── boosts/       # Campagnes pub
│       ├── payments/     # Stripe
│       ├── files/        # Upload S3
│       └── admin/        # Dashboard admin
├── pages/           # Next.js pages (port 3001)
│   ├── index.tsx         # Feed principal
│   └── admin/            # Dashboard admin
├── client/          # Composants React
│   └── components/
│       ├── Post/         # PostCard + feed
│       ├── Capsule/      # Drawer + checkout
│       └── Boost/        # Modal boost
└── shared/          # Types partagés
```

## Modèle économique

| Source       | Mécanisme                                  |
|--------------|--------------------------------------------|
| Commissions  | 15% sur chaque vente de capsule            |
| Boosts       | Budget fixe au clic (5€ → 100€)            |

## Routes API

| Méthode | Route                         | Auth     | Description               |
|---------|-------------------------------|----------|---------------------------|
| GET     | /api/posts/feed               | Non      | Feed paginé               |
| POST    | /api/posts                    | Oui      | Publier un post           |
| GET     | /api/capsules/post/:id        | Non      | Capsules d'un post        |
| POST    | /api/capsules                 | Oui      | Créer une capsule         |
| POST    | /api/payments/capsule/intent  | Oui      | Paiement capsule (Stripe) |
| POST    | /api/boosts                   | Oui      | Créer un boost            |
| POST    | /api/payments/boost/intent    | Oui      | Payer un boost            |
| POST    | /api/payments/webhook         | Non      | Webhook Stripe            |
| GET     | /api/admin/stats              | Admin    | Dashboard stats           |
| GET     | /api/admin/commissions        | Admin    | Historique commissions    |
| GET     | /api/admin/boosts             | Admin    | Campagnes boost           |
| POST    | /api/files/upload-url         | Oui      | URL upload S3 présignée   |
