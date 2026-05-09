# Supra v. Agency OS

> Système d'exploitation interne de l'agence Supra v.
> Production-grade SaaS for managing clients, video production, team tasks,
> invoicing, client portals, and internal projects.

---

## 🎯 Vue d'ensemble

**Supra v. Agency OS** est l'outil interne de l'agence : un seul endroit pour
gérer toute la production, suivre l'équipe, facturer les clients et leur
donner accès à un portail privé pour valider leurs livrables.

Pensé comme un vrai SaaS premium — pas une todo-list, pas une stack noisy de
templates. Design dark, sobre, accent orange Supra (#FF450F) dosé, typographie soignée.

---

## 🏗️ Stack technique

| Couche | Technologie |
|---|---|
| Framework | **Next.js 15** (App Router, Server Components, Server Actions) |
| Langage | **TypeScript 5** (strict) |
| Styling | **Tailwind CSS 3** + **shadcn/ui** (new-york) |
| Animations | **Framer Motion** |
| Base de données | **Supabase PostgreSQL** (RLS activé) |
| Auth | **Supabase Auth** (email/password, employés uniquement) |
| Storage | **Supabase Storage** (PDFs, vidéos, documents) |
| Email | **Resend** |
| PDF | **@react-pdf/renderer** (factures & devis luxe) |
| Drag & drop | **@dnd-kit** (calendrier tâches monday-style) |
| Charts | **Recharts** |
| Hébergement | **Vercel** (`app.suprav3.com`) |
| Cron | **Vercel Cron Jobs** (rappels quotidiens) |

---

## 📁 Structure du projet

```
supra-os/
├── supabase/
│   ├── schema.sql          # Schéma complet (21 tables, 21 enums, vues, triggers)
│   ├── policies.sql        # Row Level Security
│   └── seed.sql            # Données de test réalistes
│
├── src/
│   ├── app/                # Routes Next.js (App Router)
│   │   ├── (auth)/         # /login
│   │   ├── (app)/          # Application admin/employé
│   │   ├── portal/         # Portail client (token-based)
│   │   ├── api/            # API routes (PDF, cron, webhooks)
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── components/         # Composants UI (créés au Livrable 2+)
│   │   ├── ui/             # shadcn primitives
│   │   ├── layout/
│   │   ├── dashboard/
│   │   ├── clients/
│   │   ├── videos/
│   │   ├── tasks/
│   │   ├── invoices/
│   │   ├── portal/
│   │   └── shared/
│   │
│   ├── lib/
│   │   ├── supabase/       # Clients (browser/server/admin)
│   │   ├── auth/           # Permissions & rôles
│   │   ├── portal/         # Tokens & filtres données client
│   │   ├── pdf/            # Templates React-PDF (Livrable 4)
│   │   ├── email/          # Templates Resend (Livrable 5)
│   │   ├── utils/          # cn, format dates/argent
│   │   └── constants.ts
│   │
│   ├── server-actions/     # Server Actions (CRUD, mutations)
│   ├── hooks/              # React hooks réutilisables
│   ├── types/
│   │   ├── database.ts     # Types des tables (synchro avec schema.sql)
│   │   └── domain.ts       # Maps statuts → labels/couleurs
│   └── middleware.ts       # Auth + refresh session
│
├── .env.example            # Template variables d'environnement
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── vercel.json             # Cron jobs + headers sécurité
└── DEPLOYMENT.md           # Guide complet de déploiement
```

---

## 🚀 Démarrage rapide

### Prérequis

- **Node.js ≥ 20**
- Un compte **Supabase** (free tier suffit pour démarrer)
- Un compte **Resend** (pour les emails)
- Un compte **Vercel** + accès DNS au domaine `suprav3.com`

### Installation locale

```bash
# 1. Cloner le repo (après l'avoir poussé sur GitHub)
git clone <repo-url> supra-os
cd supra-os

# 2. Installer les dépendances
npm install

# 3. Copier le template d'environnement
cp .env.example .env.local
# → Remplir les valeurs (voir DEPLOYMENT.md, étape 1)

# 4. Initialiser la base Supabase
# (Dashboard Supabase → SQL Editor → exécuter dans cet ordre)
#   1. supabase/schema.sql
#   2. supabase/policies.sql
#   3. supabase/seed.sql

# 5. Lancer le dev server
npm run dev
# → http://localhost:3000
```

### Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Dev server avec Turbopack (hot reload) |
| `npm run build` | Build de production |
| `npm run start` | Démarre le build de prod localement |
| `npm run lint` | ESLint |
| `npm run type-check` | Vérifie les types TS sans build |
| `npm run db:types` | Régénère `database.ts` depuis Supabase |

---

## 🔐 Sécurité & rôles

L'app distingue **utilisateurs internes** (employés via Supabase Auth) et
**clients** (accès portail via token unique, sans compte).

### Rôles internes

| Rôle | Périmètre |
|---|---|
| `admin` | Accès total (gestion équipe, paramètres, facturation) |
| `project_manager` | Clients, projets, tâches, production, lecture facturation |
| `commercial` | Clients, devis, factures, paiements |
| `editor` | Voit toute la production, modifie ses montages |
| `cameraman` | Voit toute la production, modifie ses tournages |
| `developer` / `designer` / `seo` | Leurs projets et tâches |
| `community_manager` | Calendrier éditorial et tâches social media |

Les permissions sont enforced **côté serveur** (RLS PostgreSQL +
helpers `lib/auth/permissions.ts`). Jamais côté client uniquement.

### Portail client

- URL : `/portal/client/[clientId]?token=xxx`
- Le token est validé **server-side** via le service role
- Les données passent par `lib/portal/filters.ts` qui strip TOUT ce qui est interne :
  notes internes, marges, charge équipe, autres clients, statuts internes vidéos, etc.
- Le client ne voit jamais qu'il existe un système Supabase derrière.

---

## 📦 État du projet — Livrable 1 (Foundation) ✅

Ce qui est livré dans cette première phase :

- ✅ **Schéma SQL complet** (21 tables, RLS, vues, triggers, fonctions helpers)
- ✅ **Policies RLS** pour tous les rôles
- ✅ **Seed réaliste** (4 employés, 6 clients, 13 vidéos, factures, tâches)
- ✅ **Types TypeScript** synchronisés avec le schéma
- ✅ **Clients Supabase** (browser / server / admin)
- ✅ **Middleware Next.js** avec refresh session
- ✅ **Helpers permissions & rôles**
- ✅ **Portail client** (génération + validation tokens, filtres données)
- ✅ **Design system** (Tailwind config + CSS variables, palette dark premium)
- ✅ **Configuration Vercel** (`vercel.json` + cron jobs prêts)
- ✅ **Documentation déploiement** complète (`DEPLOYMENT.md`)

### Prochaines étapes — Livrables 2 → 5

| # | Livrable | Contenu |
|---|---|---|
| 2 | **UI Core** | Sidebar, topbar, login page, design system shadcn |
| 3 | **Modules clés** | Dashboard, Clients, Vidéos (kanban), Tâches (kanban + calendrier monday-style avec drag&drop) |
| 4 | **Facturation + Portail** | CRUD factures/devis, templates PDF luxe React-PDF, portail client complet |
| 5 | **Notifications + Cron** | Rappels quotidiens employés, emails Resend, alerts deadlines |

---

## 🎨 Direction design

> Le design ne doit JAMAIS ressembler à du "AI generated".

**Palette** — noir profond + orange Supra (accent premium, dosé) :

```
bg deep      #080706    /  card        #11100F
surface      #181513    /  bouton sombre #1A0703
border chaude #6B2416   /  brun sombre #3A120A
text         #F8F4EF    /  text muted  #A8A19A
accent       #FF450F    /  glow        #FF6A2A
succès       #3DBD7D    (paiements / validé uniquement)
alerte       rouge-orangé discret
info         #5B8FD4
```

**Typographie** :
- **DM Sans** (UI, body, headings) — pour la lisibilité moderne
- **DM Serif Display** (chiffres, titres hero, factures) — pour la touche luxe

**Inspiration** : Linear (clarté), Stripe (qualité visuelle),
monday.com (gestion tâches), Apple/Framer (fluidité).

**À éviter** :
- emojis partout
- couleurs criardes
- typographie générique
- spacing serré
- gradients flashy

---

## 📚 Documentation

- **`DEPLOYMENT.md`** — guide complet Supabase + Vercel + DNS `app.suprav3.com`
- **`supabase/schema.sql`** — schéma de référence (commenté)
- **`supabase/policies.sql`** — toutes les policies RLS commentées
- **`src/types/database.ts`** — contract TypeScript du domain model

---

## 🛡️ License

Propriétaire — Supra v. — Marrakech, Maroc.
# Supra-v-os
# Supra-v-os
