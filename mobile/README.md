# Supra OS — Mobile (Expo)

Application mobile compagnon de Supra v. Agency OS. **App séparée** : elle ne
modifie rien dans l'application web Next.js et ne partage aucun code avec elle
(les types/règles utiles sont copiés dans `types/` et `lib/roles.ts`).

## Stack

- Expo SDK 54 + React Native 0.81 + TypeScript (strict)
- Expo Router (file-based routing, `app/`)
- Supabase JS (clé **anon publique** uniquement, RLS appliquée côté serveur)
- Expo SecureStore pour la persistance de session (adaptateur chunké dans
  `lib/secure-session-store.ts`)

## Phase 1 (actuelle)

- Connexion e-mail / mot de passe (mêmes identifiants que le web)
- Persistance et restauration de session (SecureStore)
- Routes protégées (`app/index.tsx` + `app/(tabs)/_layout.tsx`)
- Accueil role-aware (compteurs tâches/vidéos via requêtes RLS)
- Profil + déconnexion
- Blocages alignés sur le web : pas de profil employé → refus ; employé
  inactif/archivé → refus ; `must_change_password` → refus (le changement de
  mot de passe se fait sur le web)

## Phase 2 — Tâches

- Onglet « Tâches » (masqué pour finance/commercial, comme sur le web)
- Liste RLS-scopée (50 max, tri échéance puis création), pull-to-refresh,
  skeletons, états vide/erreur
- Filtres : Toutes / À faire / En cours / En révision / Bloqué / Terminé /
  En retard (appliqués côté serveur)
- Carte compacte : titre, client, badges statut/priorité/retard, échéance,
  initiales des assignés
- Détail tâche (`app/tasks/[id].tsx`) : description, client, dates, assignés
- « Marquer comme terminé » : update direct `status='done'` +
  `completed_at` (même patch que `updateTaskStatusAction` web) ; si la RLS
  refuse (0 ligne mise à jour), message propre sans contournement

## Phase 3 — Calendrier

- Onglet « Calendrier » (masqué pour finance/commercial, même règle que Tâches)
- Filtres : Aujourd’hui / Demain / Cette semaine (jusqu’à dimanche) / À venir
  (30 jours), calculés en heure locale
- Contenu : échéances de tâches (`tasks.deadline`) + pour les rôles vidéo,
  tournages (`videos.shooting_date`) et livraisons (`videos.client_delivery_at`
  avec repli legacy `videos.delivery_deadline`, même règle que le web
  `effectiveClientDeliveryIso`)
- Section « En retard » (tâches ouvertes échues) sur le filtre Aujourd’hui,
  puis regroupement par jour
- Carte : type (Tâche/Tournage/Livraison), titre, client, date/heure, badge
  statut, badge retard, assignés ; les tâches ouvrent `/tasks/[id]`, les
  événements vidéo ne sont pas cliquables avant la Phase 4

## Phase 4 — Vidéos

- Onglet « Vidéos » visible uniquement pour admin / chef de projet / monteur /
  cadreur / community manager (`hasVideoAccess`, copie de la nav web)
- Liste RLS-scopée (50 max, archivées/annulées exclues), tri par livraison
  effective (même règle que le web), pull-to-refresh, skeletons, états
  vide/erreur
- Filtres alignés sur les colonnes kanban web : Toutes / Préparation /
  Tournage / Montage / En révision / Attente client / Livré
- Carte : titre, client, badge statut, badge format, badge « Livraison en
  retard » (même règle que `isVideoDeliveryOverdueActive` web), dates tournage
  et livraison, chips équipe (video_assignments + legacy editor/cameraman)
- Détail (`app/videos/[id].tsx`) **en lecture seule** : brief/sujet, dates,
  équipe avec rôles, tâches liées (cliquables vers `/tasks/[id]`). Les
  changements de statut vidéo restent sur le web (effets de bord serveur :
  événements tournage, sync tâche de production, notifications)
- Les cartes Tournage / Livraison du calendrier ouvrent désormais
  `/videos/[id]`

## Phase 5 — Polish & préparation aux tests

- Branding : nom « Supra v OS », scheme `supravos`, icône/splash placeholders
  (carré orange Supra sur noir profond) dans `assets/` — **à remplacer** par
  les vrais visuels : mêmes noms de fichiers (`icon.png` 1024×1024,
  `adaptive-icon.png` 1024×1024 RGBA, `splash-icon.png` 512×512), aucun
  changement de config nécessaire
- Gestion d'erreurs unifiée (`lib/errors.ts`) : messages français propres
  (connexion, session expirée, autorisation, chargement) ; aucun détail brut
  Supabase/PostgREST affiché ; logs bruts uniquement en dev (`__DEV__`)
- Accueil : cartes statistiques cliquables (raccourcis vers Tâches /
  Calendrier / Vidéos)
- `eas.json` : profils development / preview / production (aucun build lancé)

## Phase 6 — Notifications & alertes critiques

- Centre de notifications (`app/notifications.tsx`) : mes notifications
  uniquement — filtre explicite `recipient_user_id = utilisateur connecté`
  en plus de la RLS `notifications_select_own` (la policy laisse les admins
  lire toutes les lignes côté web ; sur mobile le centre reste personnel,
  les signaux équipe passant par les alertes de l'Accueil), 50 max, non-lues
  mises en avant, « Tout marquer comme lu », pull-to-refresh, états
  vide/erreur
- Marquage lu optimiste (RLS `notifications_update_own` scope l'écriture)
- Deep links : notification `task`/`video` avec `related_entity_id` →
  `/tasks/[id]` ou `/videos/[id]` (respect du rôle ; les autres types —
  facture, devis, digest — restent web-only, non cliquables)
- Accueil : cloche avec badge non-lus + cartes d'alerte dérivées de requêtes
  RLS-scopées — tâches en retard, livraisons vidéo en retard (règle
  `isVideoDeliveryOverdueActive` du web), tournages aujourd'hui — chacune
  ouvrant l'onglet concerné ; re-synchronisation au retour sur l'onglet
- Calendrier : les livraisons vidéo en retard rejoignent la section
  « En retard » (filtre Aujourd'hui, rôles vidéo)
- Profil : accès « Notifications »

Pas de push Expo dans cette phase (nécessite un envoi côté serveur — à
valider séparément) : notifications in-app uniquement.

## Phase 7 — Améliorations Tâches

- Recherche sur l'écran Tâches (≥ 2 caractères, debounce 300 ms) : titre de
  tâche (`ilike`), nom de client et nom d'assigné via lookups RLS-scopés sur
  `clients` / `employees` / `task_assignments` — requêtes bornées (≤ 50),
  fusionnées et dédupliquées, combinables avec les filtres de statut
- Changement de statut sûr depuis le détail : À faire / En cours /
  En révision / Terminé uniquement — `blocked` et `waiting_client` exclus
  (effets de bord notifications côté web), archivage/suppression exclus.
  Passage à Terminé : `completed_at = now` ; sortie de Terminé :
  `completed_at` conservé (comportement web identique, jamais effacé)
- Chip « Vidéo liée » sur le détail tâche (si `video_id` et vidéo visible par
  la RLS + rôle vidéo) → ouvre `/videos/[id]` ; invisible sinon, aucune fuite

## Phase 8 — Création de tâche (admin / chef de projet)

- Bouton « + Nouvelle tâche » sur l'écran Tâches, visible uniquement pour
  admin / chef de projet (`isAdminOrPM`) ; l'écran `app/tasks/new.tsx`
  redirige les autres rôles
- Champs : titre (requis), description, échéance (picker date + heure,
  heure par défaut 18:00), priorité, client (recherche, liste RLS ≤ 30),
  assignés multiples (employés actifs non archivés, RLS ≤ 30)
- Échéance : même règle que le web (`validateOperationalFutureDate`,
  horloge Europe/Paris) — jour passé bloqué (« La date ne peut pas être dans
  le passé. »), heure passée aujourd'hui bloquée
- Insertion directe RLS (`tasks_insert_operational` +
  `task_assignments_insert_operational`), rollback de la tâche si l'insert
  du pivot échoue (parité web) ; `assignee_id` legacy = premier assigné
- Effets de bord répliqués du web : ligne `activity_logs`
  (via: 'mobile') + notifications `task_assigned` aux assignés, avec
  `link_url = <EXPO_PUBLIC_WEB_APP_URL>/tasks?highlight=<taskId>` (même
  pattern que `hrefTasksOpenDetail` web ; repli `https://app.suprav3.com`
  si la variable est absente) et navigation mobile via related_entity

## Phase 9 — Redesign Apple/iOS

- Design system étendu (`constants/theme.ts`) : échelle typographique
  Apple-like (`type.largeTitle/headline/body/subhead/sectionHeader`), tokens
  sémantiques doux (danger/success/warning/info + variantes `…Soft`),
  séparateurs hairline, rayons iOS, ombres flottantes douces
  (`cardShadow`/`chipShadow`), `layout.tabBarSpace` pour la tab bar flottante
- Composants partagés (`components/ui.tsx`) : cartes sans bordure à ombre
  douce, `FilterChips` capsule mutualisé (Tâches/Calendrier/Vidéos),
  `ListRow` iOS grouped-list, `SectionLabel`, boutons ghost/danger
- Tab bar translucide floutée sur iOS (`expo-blur`), icônes Ionicons,
  bordure hairline ; solide sur Android
- Accueil façon dashboard Apple : grand titre + badge rôle capsule, cloche,
  alertes en lignes teintées douces, cartes stats avec icône, actions
  rapides capsule, section « À venir » (3 prochaines échéances, requête
  bornée)
- Tâches : recherche iOS (fond gris, icône), bouton « + » rond, cartes
  compactes (statut = point coloré + libellé, retard = petite pastille +
  date rouge, priorité affichée seulement si haute/urgente)
- Calendrier : lignes type Apple Calendar (heure à gauche, barre colorée
  par type Tâche/Tournage/Livraison), sections par jour
- Vidéos : mini-grille deux colonnes Tournage / Livraison, statut en point
  coloré, badge retard doux
- Notifications : regroupées par jour, icône par type, pastille non-lu
- Profil : sections groupées iOS (Compte / Application), déconnexion douce
- Micro-interactions : `expo-haptics` (succès création/statut, sélection
  filtres, lecture notification) ; retours visuels pressed subtils
- Accessibilité : cibles ≥ 44 pt, `accessibilityLabel/Role` sur les boutons
  à icône, contraste texte secondaire renforcé (`textSecondary`)
- Dépendances ajoutées (via `expo install`, compatibles Expo Go) :
  `expo-blur`, `expo-haptics`, `@expo/vector-icons`

## Phase 10 — Calendrier premium (vraies vues calendaires)

- Trois vues via un contrôle segmenté iOS « Mois | Semaine | Jour »
  (`components/calendar-view-switcher.tsx`) ; navigation ‹ › par période,
  bouton « Aujourd'hui »
- Vue Mois : grille réelle 6 semaines lundi-first (`calendar-month-grid.tsx`),
  entêtes Lun→Dim, cercle « aujourd'hui », capsule jour sélectionné, jours
  hors-mois estompés, jusqu'à 3 points colorés par client puis « + »
- Vue Semaine : bande hebdomadaire 7 jours avec les mêmes cellules
- Agenda du jour sous le calendrier : cartes événement (heure ou « Journée »,
  icône + libellé type, titre, client, statut, assignés, chevron), état vide
  « Aucun élément prévu ce jour. »
- Couleurs clients déterministes (`lib/client-colors.ts`) : hash djb2 sur
  `client_id` (repli nom) vers une palette de 10 tons doux (orange, bleu,
  violet, vert, ambre, rose, teal, indigo, graphite, brun) — accent (barre/
  point), fond teinté ~7 %, texte assombri lisible ; même client = même
  couleur partout. Langage visuel : couleur client = « qui », icône/couleur
  type = « quoi » (Tâche/Tournage/Livraison), rouge réservé à l'urgence
- « En retard » : section compacte (lignes point rouge doux + date rouge,
  triées de la plus ancienne), jamais de carte rouge pleine
- Données (`hooks/useCalendarEvents.ts`) : fetch par plage visible — mois
  affiché (42 jours, ≤100 tâches + ≤100 vidéos), semaine (7 j) ou jour (1 j) ;
  sélectionner un jour dans une plage chargée ne refetch pas (regroupement
  mémoire par `dayKey`) ; retards bornés (≤25 + ≤25). Mêmes requêtes RLS
  qu'avant (anciens `useCalendarWork`/`calendar-work-card` supprimés)
- Haptics : sélection de jour, changement de vue, « Aujourd'hui », ouverture
  d'événement ; a11y : libellés de cellules (« 23 août, 4 événements »),
  états selected/today, cibles ≥ 44 pt

Phases suivantes (non implémentées) : création/édition/statuts vidéo,
édition complète de tâche, suppression/archivage, SupAI, finance,
notifications push, soumission stores.

## Builds EAS

⚠️ **Toujours lancer les commandes EAS depuis `mobile/`, jamais depuis la
racine du repo.** Lancer `eas init`/`eas build` à la racine crée des
`app.json`/`eas.json` parasites à la racine et fait builder le package
Next.js (erreur « the module expo is not installed »).

Première fois (lie le projet à votre compte Expo — écrit
`extra.eas.projectId` dans `app.json`) :

```bash
cd mobile
npx eas login
npx eas init
```

Puis :

```bash
cd mobile
npx eas build --profile preview --platform android
npx eas build --profile preview --platform ios
```

Les profils de build épinglent Node `20.19.4` (requis par Expo SDK 54 /
RN 0.81 — l'image par défaut EAS peut être en Node 18). Prérequis :
identifiants Apple/Google le moment venu, et les trois variables
`EXPO_PUBLIC_*` (URL/clé Supabase, URL web) déclarées comme variables
d'environnement EAS (`npx eas env:create`) — elles ne sont pas lues depuis
`.env` en build cloud.

## Checklist QA manuelle

### Auth
- [ ] Connexion avec identifiants valides → arrive sur Accueil
- [ ] Connexion avec mauvais mot de passe → « E-mail ou mot de passe incorrect. »
- [ ] Compte sans profil employé → refus avec message clair
- [ ] Employé inactif/archivé → refus « Compte employé inactif »
- [ ] `must_change_password` → refus renvoyant vers le web (set-password)
- [ ] Fermer/rouvrir l'app → session restaurée sans re-login
- [ ] Déconnexion depuis Profil → retour au login, session effacée
- [ ] Session expirée/révoquée → retour au login avec message propre

### Rôles
- [ ] **Admin** : 5 onglets, tâches équipe complètes, toutes vidéos
- [ ] **Chef de projet** : idem admin (hors finance, absente du mobile)
- [ ] **Monteur** : tâches/vidéos assignées uniquement
- [ ] **Cadreur** : tâches/vidéos assignées uniquement
- [ ] **Community manager** : périmètre assigné, onglet Vidéos visible
- [ ] **Designer / Développeur / SEO** : pas d'onglet Vidéos ; tâches scopées
- [ ] **Finance / Commercial** : pas d'onglets Tâches/Calendrier/Vidéos

### Tâches
- [ ] La liste charge (≤ 50, tri par échéance)
- [ ] Les 7 filtres fonctionnent (dont « En retard »)
- [ ] Le détail s'ouvre ; description/dates/assignés corrects
- [ ] « Marquer comme terminé » fonctionne pour une tâche assignée
- [ ] Sur une tâche non autorisée → message « Vous n'avez pas l'autorisation… »
- [ ] Pull-to-refresh met à jour la liste

### Calendrier
- [ ] Aujourd'hui (avec section « En retard » si tâches échues)
- [ ] Demain / Cette semaine / À venir
- [ ] Carte Tâche → ouvre `/tasks/[id]`
- [ ] Carte Tournage/Livraison → ouvre `/videos/[id]`
- [ ] Rôle sans accès vidéo : aucun événement vidéo affiché

### Vidéos
- [ ] La liste charge (archivées/annulées exclues)
- [ ] Les 7 filtres fonctionnent
- [ ] Le détail s'ouvre (lecture seule) ; brief/équipe/tâches liées corrects
- [ ] Badge « Livraison en retard » correct
- [ ] Rôles refusés : onglet masqué, accès direct bloqué

### Sécurité
- [ ] Aucune clé service role / secret serveur dans `/mobile` ni dans `.env`
- [ ] Aucune erreur technique brute (SQL/PostgREST/JWT) affichée à l'écran
- [ ] Aucune donnée finance visible
- [ ] Un rôle limité ne voit jamais de tâche/vidéo/client hors de son périmètre

## Lancer l'app

```bash
cd mobile
npm install
cp .env.example .env   # puis remplir les 2 variables
npx expo start
```

Scanner le QR code avec **Expo Go** (iOS/Android), ou `i` / `a` pour un
simulateur.

## Variables d'environnement (`mobile/.env`)

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref-projet>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<clé anon / publishable>
```

Ce sont les mêmes valeurs que `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` du web. **Interdits ici** :
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `OPENROUTER_API_KEY`, secrets
SMTP — aucun secret serveur ne doit exister dans `/mobile`.

## Vérifications

```bash
npm run type-check
```

## Architecture & sécurité

- **Auth** : `supabase.auth.signInWithPassword` direct (le endpoint web
  `/api/auth/login` est basé cookies Next.js, inadapté au natif). Après
  connexion, le profil `employees` est chargé ; les mêmes portes que le web
  sont appliquées (profil manquant, inactif, must_change_password).
- **Données** : requêtes Supabase directes protégées par la RLS existante
  (`supabase/policies.sql` : `tasks_select_scoped`, `videos_select_scoped`,
  `employees_select_scoped`…). Le mobile n'ajoute aucune règle d'accès — le
  serveur reste la source de vérité ; `lib/roles.ts` ne sert qu'à masquer l'UI.
- **Rôles** : visibilité tâches/vidéos copiée de
  `src/lib/auth/nav-policy.ts` (finance/commercial sans tâches, vidéos pour
  admin/PM/monteur/cadreur/CM, designer ≈ développeur).

## Structure

```
mobile/
  app/
    _layout.tsx        # AuthProvider + Stack
    index.tsx          # gate de redirection auth
    (auth)/login.tsx   # écran de connexion
    (tabs)/            # Accueil, Profil (Tâches/Calendrier/Vidéos à venir)
  components/ui.tsx    # Card, bouton, skeleton, bannière d'erreur
  constants/theme.ts   # tokens design Supra (orange #FF3D0A, off-white…)
  hooks/useAuth.tsx    # session + profil employé + portes de connexion
  hooks/useHomeSummary.ts
  lib/supabase.ts      # client anon + SecureStore + auto-refresh
  lib/secure-session-store.ts
  lib/roles.ts         # labels + visibilité par rôle (copie de nav-policy)
  types/db.ts          # types DB minimaux (copie manuelle)
```
