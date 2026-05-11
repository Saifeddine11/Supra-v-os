# Plan de tests RLS — Supra v. Agency OS

Ce document décrit des **tests manuels** à exécuter après application des migrations RLS listées ci-dessous. Chaque test suppose une session **Supabase Auth** avec le rôle indiqué (JWT + ligne `employees` liée par `user_id`).

## Migrations concernées (ordre staging / prod)

1. `20260528120000_harden_rls_select_scope.sql` — périmètre clients, tâches, vidéos, finance, documents, objectifs mensuels (`agency_monthly_goals` : admin / finance / commercial uniquement ; pas PM ni production), notifications de base, etc.
2. `20260529103000_rls_phase2_finance_clients_notifications_logs_goals.sql` — réapplique `auth_staff_client_visible`, politique **notifications** (soi + admin), **activity_logs** (admin + chef de projet).

Sur une base déjà à jour de `20260528120000`, la phase 2 reste **idempotente** sur la fonction clients (même corps que la migration 1) et met surtout à jour policies notifications / logs.

## Prérequis

1. Appliquer les migrations sur un projet de **staging** avant la prod.
2. Utiliser le **SQL Editor** Supabase, `psql` avec impersonation JWT (`request.jwt.claim.sub`, rôle `authenticated`), ou le **client navigateur** avec la session du collaborateur de test.
3. Pour le portail client : ne pas tester les tables métier via RLS `authenticated` ; passer par `/api/portal/...` (service role côté serveur).

## Règle métier — Finance et clients

`auth_staff_client_visible` pour le rôle **finance** : le client est visible seulement s’il existe au moins une **facture**, un **devis** ou un **paiement** lié à ce `client_id`.  
**Régression possible** : un écran finance qui listait des clients « prospects » sans trace financière peut renvoyer moins de lignes ; corriger le produit (création de devis, ou requête serveur scopée) plutôt que d’élargir aveuglément la policy.

## Rollback (avant prod)

1. **Sauvegarde** : exporter les définitions actuelles (`pg_policies`, `pg_get_functiondef`) après chaque migration réussie.
2. **Restauration rapide** : revenir au commit Git précédent et réappliquer `supabase/policies.sql` + `supabase/schema.sql` du tag/commit stable, ou rejouer une migration « down » manuelle documentée dans le ticket de release.
3. **Ciblé finance** : si seul le périmètre finance pose problème, on peut temporairement élargir la branche `finance` dans `auth_staff_client_visible` (par ex. `return true` pour finance) **en staging** — à éviter en prod sans revue ; préférer ajuster les écrans.

## Scénarios de test (checklist)

### 1. Editor — `SELECT` sur `clients`

- **Action** : `select * from clients limit 20;`
- **Attendu** : uniquement les clients pour lesquels `auth_staff_client_visible` est vrai (tâches / vidéos assignées, `task_assignments` / `video_assignments`, legacy `assignee_id` / `editor_id` / `cameraman_id`, watchers le cas échéant).
- **Échec typique** : toutes les lignes.

### 2. Editor — `SELECT` sur `invoices`

- **Attendu** : **0 ligne** (pas admin, PM, finance, ni commercial sur ses comptes).

### 3. Editor — `SELECT` sur `payments`

- **Attendu** : **0 ligne**.

### 4. Editor — `SELECT` sur `agency_monthly_goals`

- **Attendu** : **0 ligne**.

### 5. Cameraman — `SELECT` sur `videos`

- **Attendu** : uniquement les vidéos où il est `cameraman_id`, ou présent dans `video_assignments` (rôle cameraman selon schéma), ou logique équivalente héritée.

### 6. Cameraman — `SELECT` sur `clients`

- **Attendu** : uniquement les clients liés à ses vidéos / tâches visibles (même logique que `auth_staff_client_visible` pour ce rôle).

### 7. Commercial — `SELECT` sur `clients`

- **Attendu** : lignes où `account_manager_id = auth_employee_id()` (aligné sur la fonction).

### 8. Commercial — `SELECT` sur `payments`

- **Attendu** : uniquement les paiements dont `client_id` est un client dont `account_manager_id = auth_employee_id()` (policy `payments_select_scoped`). Pas les paiements des autres commerciaux.

### 9. Finance — `SELECT` sur `payments`

- **Attendu** : toutes les lignes autorisées par la policy finance (accès global admin/finance).

### 10. Chef de projet — `SELECT` sur `payments`

- **Attendu** : **0 ligne** (`project_manager` absent de `payments_select_scoped`).

### 11. Chef de projet — `SELECT` sur `agency_monthly_goals`

- **Attendu** : **0 ligne** (rôle non listé dans `agency_monthly_goals_select_scoped`).

### 12. Notifications

- **Action** : `select * from notifications limit 50;`
- **Attendu** : lignes où `recipient_user_id = auth.uid()` **ou** utilisateur **admin** (support / visibilité globale contrôlée). Pas de lecture pour tous les `authenticated`.

### 13. Activity logs — rôle editor

- **Attendu** : **0 ligne** en `SELECT` sur `activity_logs` (policy réservée **admin** et **chef de projet**).

### 14. Activity logs — rôle chef de projet

- **Attendu** : lecture possible si `auth_is_admin_or_pm()` (besoin dashboard / activité projet). Si la politique produit devient « admin seul », mettre à jour ce scénario et les écrans associés.

### 15. Task assignments — editor

- **Attendu** : uniquement les lignes utiles au périmètre des tâches visibles (assignations le concernant ou cohérentes avec les policies `task_assignments` / `tasks`). Vérifier qu’aucun listing global n’apparaît.

### 16. Video assignments — editor

- **Attendu** : idem pour les vidéos dont il est éditeur (assignations propres ou nécessaires aux vidéos visibles).

### 17. Portail client

- **Vérifier** via `/api/portal/...` uniquement : token + `clientId` ; pas de dépendance aux policies staff `authenticated` sur les tables métier pour le contenu portail.

## Régression applicative (parcours manuel)

Après migration : **login**, **dashboard** par rôle, **/clients**, **/tasks**, **/tasks/calendar**, **/videos**, **/documents**, **/invoices**, **/quotes**, **/payments**, **/reports**, **/portal-admin**, **/settings**, **/notifications**, portail client.

Si une page est vide ou erreur RLS : **ne pas** élargir la policy par défaut — vérifier requête (scope), passage par **route serveur** ou **vue** adaptée, et données métier (ex. finance sans trace sur un client).

## Fichier SQL complémentaire

Scripts et rappels : `supabase/security-tests/rls_scope_tests.sql`.
