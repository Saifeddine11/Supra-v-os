# Guide de déploiement — Supra v. Agency OS

> Ce guide te conduit de zéro à `https://app.suprav3.com` en production.
> Suis les étapes dans l'ordre. Garde ce document à côté de toi.

---

## 📋 Vue d'ensemble

| # | Étape | Temps estimé |
|---|---|---|
| 1 | Créer le projet Supabase + appliquer le schéma | 15 min |
| 2 | Créer les buckets Storage Supabase | 5 min |
| 3 | Créer le 1er compte admin (Sif) + lier l'employé | 5 min |
| 4 | Configurer Resend (domaine + API key) | 15 min |
| 5 | Pousser le code sur GitHub | 5 min |
| 6 | Connecter Vercel + déployer | 10 min |
| 7 | Configurer le sous-domaine `app.suprav3.com` | 10 min |
| 8 | Activer Vercel Cron Jobs | 2 min |
| 9 | Créer les comptes employés restants | 10 min |
| 10 | Vérifications finales | 10 min |

**Total : ~ 1h30 si tout va bien.**

---

## 🟢 Étape 1 — Créer le projet Supabase

### 1.1 Créer le projet

1. Va sur [supabase.com](https://supabase.com) → **New project**.
2. Settings :
   - **Name** : `supra-agency-os` (ou ce que tu veux)
   - **Database password** : génère un mot de passe fort, **note-le** dans un gestionnaire
   - **Region** : `eu-west-3` (Paris) — le plus proche du Maroc en Europe
   - **Pricing Plan** : Free pour commencer, upgrade Pro quand le projet grossit
3. Attends ~2 min que le projet soit provisionné.

### 1.2 Récupérer les credentials

Dans le dashboard Supabase → **Settings** → **API** :

| Variable .env | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | "Project URL" (ex: `https://abcdefg.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "Project API keys" → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | "Project API keys" → `service_role` `secret` |
| `SUPABASE_PROJECT_ID` | La partie avant `.supabase.co` (ex: `abcdefg`) |

⚠️ **Le `service_role` key contourne RLS — ne jamais l'exposer côté client.**

### 1.3 Appliquer le schéma

Dans le dashboard Supabase → **SQL Editor** → **+ New query**.

Exécute les fichiers **dans l'ordre exact** :

```
1. supabase/schema.sql      ← crée toutes les tables, enums, triggers, vues
2. supabase/policies.sql    ← active la RLS et installe les policies
3. supabase/seed.sql        ← insère les données de démarrage
```

Pour chacun :
- Copie tout le contenu du fichier
- Colle dans le SQL Editor
- Clique **Run** (Cmd+Enter)
- Vérifie qu'il n'y a pas d'erreur (en bas)

✅ **Vérification** : va dans **Table Editor** → tu dois voir 21 tables, dont
`clients` (6 lignes), `videos` (13 lignes), `invoices` (6 lignes).

---

## 🪣 Étape 2 — Créer les buckets Storage

Dans le dashboard Supabase → **Storage** → **+ New bucket**.

Crée **4 buckets** :

| Nom du bucket | Public ? | Usage |
|---|---|---|
| `invoices` | Non | PDFs factures (accès via signed URLs) |
| `quotes` | Non | PDFs devis |
| `documents` | Non | Livrables, briefs, rushes |
| `avatars` | **Oui** | Photos profil employés et logos clients |

Pour chaque bucket non-public, clique sur le bucket → **Policies** → ajoute :

```sql
-- Lecture pour utilisateurs authentifiés
create policy "authenticated_read"
  on storage.objects for select
  to authenticated
  using ( bucket_id in ('invoices', 'quotes', 'documents') );

-- Écriture pour utilisateurs authentifiés
create policy "authenticated_write"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id in ('invoices', 'quotes', 'documents') );

-- Mise à jour
create policy "authenticated_update"
  on storage.objects for update
  to authenticated
  using ( bucket_id in ('invoices', 'quotes', 'documents') );
```

Pour le bucket `avatars` (public) :

```sql
create policy "public_avatars_read"
  on storage.objects for select
  to public
  using ( bucket_id = 'avatars' );

create policy "authenticated_avatars_write"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'avatars' );
```

---

## 👤 Étape 3 — Créer le compte admin (Sif)

### 3.1 Créer l'utilisateur Auth

Dashboard Supabase → **Authentication** → **Users** → **+ Add user** → **Create new user** :

- **Email** : `sif@suprav3.com`
- **Password** : génère un mot de passe fort
- **Auto Confirm User** : ✅ coché

→ **Create user**

### 3.2 Lier l'employé existant à l'utilisateur

Le seed a inséré un employé "Sif Eddine" avec un id fixe. Il faut maintenant
lier cet employé à l'utilisateur Auth qu'on vient de créer.

Récupère l'UUID du nouvel utilisateur (Authentication → Users → clique sur Sif → copie l'UUID).

Dans **SQL Editor**, exécute :

```sql
update employees
set user_id = 'COLLE_ICI_LUUID_DE_SIF'
where email = 'sif@suprav3.com';
```

✅ **Vérification** :

```sql
select id, full_name, email, role, user_id from employees where email='sif@suprav3.com';
-- user_id doit ne plus être null
```

---

## 📧 Étape 4 — Configurer Resend (envoi emails)

### 4.1 Créer le compte

1. Va sur [resend.com](https://resend.com) → sign up.
2. **Domains** → **+ Add Domain** → `suprav3.com`.
3. Resend te donne ~4 enregistrements DNS à ajouter (SPF, DKIM, MX optionnel
   pour réception, DMARC).
4. Ajoute-les dans ton registrar (où le domaine `suprav3.com` est géré).
   - Pour Hostinger : Domains → suprav3.com → DNS / Nameservers → Manage DNS records → Add record.
5. Reviens dans Resend → clique **Verify** sur le domaine. La propagation DNS
   peut prendre 5 min à quelques heures.

### 4.2 Récupérer l'API key

Resend → **API Keys** → **+ Create API Key**
- **Name** : `supra-os-production`
- **Permission** : `Sending access`
→ copie la clé (`re_xxxxxxxx...`) **immédiatement**, elle ne sera plus visible.

### 4.3 Tester (optionnel mais recommandé)

Dans Resend → **Emails** → **+ Send Email** → envoie un email de test à
`sif@suprav3.com` avec ton domaine `noreply@suprav3.com` comme expéditeur.
Si l'email arrive, c'est bon.

---

## 🐙 Étape 5 — Pousser le code sur GitHub

```bash
cd supra-os

# Initialiser git
git init
git add .
git commit -m "Initial commit — Livrable 1 Foundation"

# Créer un repo privé sur github.com (par exemple : suprav3/supra-os)
# Puis :
git branch -M main
git remote add origin https://github.com/suprav3/supra-os.git
git push -u origin main
```

⚠️ **Vérifie que `.env.local` est bien gitignoré** (il l'est déjà via `.gitignore`).

---

## 🚀 Étape 6 — Déployer sur Vercel

### 6.1 Importer le projet

1. Va sur [vercel.com/new](https://vercel.com/new).
2. **Import Git Repository** → sélectionne `supra-os`.
3. **Framework Preset** : Next.js (auto-détecté).
4. **Root Directory** : `./` (laisser par défaut).
5. **Build Command** : `next build` (par défaut).
6. **Install Command** : `npm install` (par défaut).
7. **Region** : par défaut (auto). Ou force Frankfurt (`fra1`) — déjà fixé dans `vercel.json`.

### 6.2 Variables d'environnement

Avant de cliquer **Deploy**, déplie **Environment Variables** et ajoute-les
**toutes** depuis `.env.example` :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_PROJECT_ID=xxxxxxxx
NEXT_PUBLIC_APP_URL=https://app.suprav3.com
NEXT_PUBLIC_AGENCY_NAME=Supra v.
NEXT_PUBLIC_AGENCY_EMAIL=hello@suprav3.com
NEXT_PUBLIC_AGENCY_PHONE=+212 6 00 00 00 00
NEXT_PUBLIC_AGENCY_ADDRESS=Marrakech, Maroc
RESEND_API_KEY=re_xxxxxxx
EMAIL_FROM=Supra v. <noreply@suprav3.com>
EMAIL_REPLY_TO=hello@suprav3.com
CRON_SECRET=générer_avec_openssl_rand_hex_32
```

Pour générer `CRON_SECRET` localement :

```bash
openssl rand -hex 32
```

→ Clique **Deploy**.

✅ Tu obtiens une URL temporaire `supra-os-xxx.vercel.app`. Elle marche déjà.

---

## 🌐 Étape 7 — Configurer `app.suprav3.com`

### 7.1 Côté Vercel

Dashboard du projet → **Settings** → **Domains** → **Add Domain** :

- Tape `app.suprav3.com` → **Add**.
- Vercel affiche les enregistrements DNS à ajouter (généralement un `CNAME`).

### 7.2 Côté registrar (Hostinger ou autre)

Va sur le DNS de `suprav3.com` et ajoute :

| Type | Name | Value | TTL |
|---|---|---|---|
| `CNAME` | `app` | `cname.vercel-dns.com` | 3600 |

Si Vercel demande un type différent (`A` record), suis ce qu'il indique.

### 7.3 Vérification

Reviens dans Vercel → la coche verte apparaît dès que la propagation DNS est
terminée (5 min à 1h). En attendant tu peux toujours utiliser l'URL `.vercel.app`.

✅ Une fois validé, `https://app.suprav3.com` charge ton app et le SSL est
auto-géré par Vercel.

---

## ⏰ Étape 8 — Activer les Cron Jobs

Le fichier `vercel.json` configure déjà 4 cron jobs :

| Endpoint | Fréquence | Rôle |
|---|---|---|
| `/api/cron/morning-reminders` | tous les jours 09:00 (Casablanca) | Rappels matinaux par employé |
| `/api/cron/deadline-alerts` | toutes les 2h | Alerts deadlines proches |
| `/api/cron/evening-summary` | tous les jours 18:00 | Résumé fin de journée |
| `/api/cron/overdue-invoices` | tous les jours 07:00 | Marque factures en retard |

> Les endpoints seront créés au **Livrable 5**. Pour l'instant, le `vercel.json`
> est en place mais les routes répondront 404 jusqu'à ce qu'on code les handlers.

Les cron jobs sont **automatiquement activés** dès le 1er deploy si tu es sur
un plan Vercel Pro. Sur le plan Hobby (gratuit), tu as droit à 2 crons toutes
les 24h. Si tu restes en Hobby, retire les 2 crons fréquents (`deadline-alerts`
et `morning-reminders`) ou passe en Pro (~20$/mois).

### 8.1 Sécuriser les cron endpoints

Chaque endpoint cron vérifiera `Authorization: Bearer ${CRON_SECRET}`.
Vercel envoie ce header automatiquement avec la valeur de la variable
d'environnement `CRON_SECRET`. Code de référence (Livrable 5) :

```ts
// app/api/cron/morning-reminders/route.ts
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ... envoi des rappels
}
```

---

## 👥 Étape 9 — Créer les comptes des autres employés

Pour chaque membre de l'équipe (Yasmine, Mohamed, Karim) :

### 9.1 Créer l'utilisateur Auth

Dashboard Supabase → **Authentication** → **Users** → **+ Add user**.

| Email | Notes |
|---|---|
| `yasmine@suprav3.com` | Monteuse |
| `mohamed@suprav3.com` | Caméraman |
| `karim@suprav3.com` | Community Manager |

Mot de passe temporaire à leur communiquer (ils pourront le changer ensuite).

### 9.2 Lier les utilisateurs aux employés

Dans **SQL Editor**, pour chaque employé, récupère le `user_id` correspondant
puis exécute :

```sql
update employees
set user_id = 'UUID_DE_YASMINE_AUTH'
where email = 'yasmine@suprav3.com';

update employees
set user_id = 'UUID_DE_MOHAMED_AUTH'
where email = 'mohamed@suprav3.com';

update employees
set user_id = 'UUID_DE_KARIM_AUTH'
where email = 'karim@suprav3.com';
```

✅ **Vérification finale** :

```sql
select full_name, email, role, user_id from employees order by full_name;
-- Tous les user_id doivent être renseignés
```

---

## ✅ Étape 10 — Vérifications finales

### 10.1 L'app charge

- Va sur `https://app.suprav3.com`
- Tu es redirigé vers `/login`
- Connecte-toi avec `sif@suprav3.com` + ton mot de passe
- Tu arrives sur `/dashboard` (qui sera implémenté au Livrable 3 — pour l'instant page vide)

### 10.2 L'API Supabase fonctionne

Dans **Settings** → **API** du dashboard Supabase, tu peux faire un test rapide
via l'API REST. Mais le vrai test viendra avec les premiers écrans (Livrable 2).

### 10.3 Les emails partent

Quand le Livrable 5 sera en place, tu pourras envoyer un email test depuis
les **Settings** de l'app.

### 10.4 Les sauvegardes Supabase

Dashboard Supabase → **Database** → **Backups**.
- Sur le plan Free : backups quotidiens, conservés 7 jours.
- Sur Pro : 30 jours + Point-in-time recovery.

→ **Recommandé** : passer en Pro dès que des données réelles sont en prod (~25$/mois).

---

## 🛠️ Maintenance & opérations courantes

### Régénérer les types TypeScript après une modif du schéma

```bash
npx supabase login
npm run db:types
# → écrit dans src/types/database.generated.ts
```

Puis copier-coller les changements pertinents dans `src/types/database.ts`
(la version maintenue à la main pour rester lisible et éditable).

### Régénérer un token portail client

Pour l'instant en SQL (UI dédiée au Livrable 4) :

```sql
update client_portals
set token = encode(gen_random_bytes(32), 'hex'),
    is_active = true,
    expires_at = now() + interval '1 year'
where client_id = 'aaaa1111-1111-1111-1111-aaaaaaaaaaaa';
```

### Marquer manuellement les factures en retard

```sql
select mark_overdue_invoices();
```

(Sera automatique via cron à partir du Livrable 5.)

### Voir la charge équipe

```sql
select full_name, role, active_tasks, urgent_tasks, overdue_tasks, load_percent
from v_employee_workload
order by load_percent desc;
```

### Voir le statut éditorial du mois

```sql
select * from v_client_editorial_status;
```

---

## 🚨 Troubleshooting

### "Failed to fetch" en local

→ Variable `NEXT_PUBLIC_SUPABASE_URL` manquante ou typo dans `.env.local`.

### "JWT expired" / déconnexions intempestives

→ Vérifie que le `middleware.ts` est bien présent à la racine de `src/`.
→ Vérifie que les cookies Supabase ne sont pas bloqués par le navigateur.

### Le portail client renvoie "Lien invalide"

→ Token expiré ou désactivé. Régénère via la requête SQL ci-dessus.

### Les cron Vercel ne s'exécutent pas

→ Vérifie le plan (Hobby = 2/jour max).
→ Vérifie l'onglet **Crons** dans le dashboard Vercel : ils doivent y apparaître.
→ Logs : Project → **Logs** → filtre `path:/api/cron/`.

### `app.suprav3.com` ne pointe pas

→ Attendre la propagation DNS (jusqu'à 1h).
→ Tester `dig app.suprav3.com` ou `nslookup app.suprav3.com`.

---

## 📞 Support technique

- Supabase status : https://status.supabase.com
- Vercel status : https://www.vercel-status.com
- Resend status : https://status.resend.com

---

**Une fois ce guide complet validé**, on passe au **Livrable 2 — UI Core**.
