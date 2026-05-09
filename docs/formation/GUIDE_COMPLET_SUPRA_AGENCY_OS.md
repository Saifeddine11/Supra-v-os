---
title: Guide complet d'utilisation — Supra v. Agency OS
version: 2026-05-rev2
lang: fr-FR
---

# Guide complet d'utilisation — Supra v. Agency OS

**Version document :** mai 2026 · **Application :** outil web interne hébergé (accès sécurisé par compte employé), URL de production type **`https://app.suprav3.com`**.

**Public :** administrateur, équipe interne, rôles commerciaux et opérationnels — **y compris les profils non techniques** (ce guide évite le jargon informatique sauf en sécurité et glossaire).

---

<div class="toc">

## Sommaire

1. [Introduction](#1-introduction)
2. [Vue globale du système](#2-vue-globale-du-système)
3. [Rôles utilisateurs](#3-rôles-utilisateurs)
4. [Formation administrateur](#4-formation-administrateur)
5. [Formation équipe](#5-formation-équipe)
6. [Workflow client complet](#6-workflow-client-complet)
7. [Workflow production vidéo](#7-workflow-production-vidéo)
8. [Workflow tâches](#8-workflow-tâches)
9. [Workflow devis](#9-workflow-devis)
10. [Workflow factures & paiements](#10-workflow-factures--paiements)
11. [Workflow documents](#11-workflow-documents)
12. [Workflow rapports](#12-workflow-rapports)
13. [Portail client](#13-portail-client)
14. [Notifications & rappels](#14-notifications--rappels)
15. [Emails automatiques](#15-emails-automatiques)
16. [Paramètres (Settings)](#16-paramètres-settings)
17. [Sécurité](#17-sécurité)
18. [Routines quotidiennes](#18-routines-quotidiennes)
19. [Checklists par rôle](#19-checklists-par-rôle)
20. [Cas pratiques](#20-cas-pratiques)
21. [Erreurs fréquentes](#21-erreurs-fréquentes)
22. [Glossaire](#22-glossaire)
23. [Conclusion](#23-conclusion)

**Annexes :** [Quick Start Admin](#annexe-a--quick-start-admin) · [Quick Start Équipe](#annexe-b--quick-start-équipe)

</div>

---

## 1. Introduction

Supra v. Agency OS est l’outil interne de pilotage d’agence : clients, projets, production vidéo, tâches, devis et factures, documents, rapports, portail client sécurisé, notifications et journaux d’activité.

**Objectifs pédagogiques de ce document :**

- Comprendre **qui** fait **quoi** selon le rôle.
- Enchaîner les **parcours métier** (client, vidéo, tâche, finance, documents, rapports).
- Utiliser le **portail** sans compromettre la sécurité.
- Savoir où agir en cas d’**erreur** fréquente.

> **Important.** Les clients **ne reçoivent pas** un identifiant dans l’application interne. Leur accès passe par le **portail** avec un **lien personnel** contenant un **code secret** dans l’adresse (identifiant client + jeton).

Ce guide reflète l’état **actuel** du produit dans le dépôt. En cas d’écart après une mise à jour, se fier à l’**interface** ; l’admin peut vérifier les fichiers techniques du projet (`README`, `SECURITY_CHECKLIST.md`, dossier des migrations base de données).

### 1.1 Déploiement de référence

L’URL de production visée est **`https://app.suprav3.com`**. Sur un **environnement de test** (aperçu avant mise en ligne), l’adresse du site peut changer : l’**administrateur** doit s’assurer que l’URL publique du site et les **adresses de retour après connexion** configurées chez l’hébergeur de la base de données sont **cohérentes**, sinon la connexion peut boucler ou échouer.

---

## 2. Vue globale du système

### 2.1 Modules présents dans l’application

| Module | Route(s) typique(s) | Rôle principal |
|--------|---------------------|----------------|
| Tableau de bord | `/dashboard` | Synthèse KPI, accès rapides, notifications, activité récente |
| Clients | `/clients`, `/clients/[id]` | Fiches client, portail, projets liés |
| Projets clients | `/projects`, `/projects/[id]` | Projets rattachés à un client |
| Projets internes | `/internal`, `/internal/[id]` | Projets non facturés client (interne) |
| Vidéos | `/videos` | Pipeline production, statuts, équipe |
| Calendrier éditorial | `/editorial` | Vue éditoriale / calendrier contenu |
| Tâches | `/tasks` | Liste et suivi des tâches |
| Calendrier tâches | `/tasks/calendar` | Vue calendrier |
| Équipe | `/team`, `/team/[id]` | Annuaire, charge de travail ; **gestion des membres (création, rôles, archivage)** réservée à l’**administrateur** |
| Devis | `/quotes`, `/quotes/[id]` | Propositions premium, PDF, conversion facture |
| Factures | `/invoices` | Facturation, statuts, PDF |
| Paiements | `/payments` | Enregistrement des paiements liés aux factures |
| Documents | `/documents` | Fichiers Storage, URLs, liens, visibilité portail |
| Rapports | `/reports`, `/reports/[id]` | Rapports client, PDF, WhatsApp |
| Portail client | `/portal/client/[clientId]?token=…` | Espace client sans compte « app » |
| Administration portails | `/portal-admin` | Vue des accès portail |
| Notifications | `/notifications` | Centre de notifications in-app |
| Paramètres | `/settings` | Agence, préférences notifications, intégrations, thème |
| Accès refusé | `/access-denied` | UX 403 lorsque le rôle ne suffit pas |

### 2.2 Ce qui est partiel ou hybride (honnêteté produit)

| Élément | Détail |
|---------|--------|
| Tableau de bord | Plusieurs **indicateurs** sont alimentés en **données réelles** (clients actifs, tâches, vidéos, validations, aperçu finance). Certains **blocs illustratifs** (files d’attente très détaillées, graphiques sur plusieurs mois) peuvent encore s’appuyer sur **données de démonstration** — lire les sous-titres sur l’écran. |
| Storage | Buckets **documents**, **deliverables**, **reports**, **quotes**, **invoices** sont prévus ; l’**upload principal** dans l’UI concerne surtout le bucket **documents**. Les PDF devis/facture/rapport sont **générés à la volée** (pas obligatoirement stockés dans Storage). |
| Calendrier éditorial | Module présent ; niveau de finition métier à valider avec votre process réel. |
| Thème | Clair / sombre / système — préférence **enregistrée sur votre navigateur** (chaque poste garde son réglage). |
| Rapports — écriture | L’écran permet à l’**admin**, au **chef de projet** et au **commercial** d’ouvrir « Nouveau rapport » ; les **règles de sécurité en base** n’autorisent l’**enregistrement** qu’à l’**admin** et au **chef de projet**. Un **commercial** peut donc voir le formulaire mais recevoir une **erreur à la sauvegarde** : faire créer le rapport par un PM ou l’admin (alignement produit à venir). |
| Module Équipe (admin) | Création de fiche sans compte de connexion (badge **Auth non lié**), rôle **Finance**, archivage, protection du **dernier administrateur** — nécessite les **migrations** base à jour (`finance`, `archived_at`, etc.). |

> **À ne pas faire.** Ne pas présenter le dashboard comme « 100 % données réelles » sans vérifier les libellés « maquette » ou « démo » sur la page du jour.

### 2.3 Tableau de bord (`/dashboard`)

| Zone | Usage |
|------|--------|
| **KPI** | Vue synthétique : clients actifs, tâches urgentes / en retard, vidéos en cours, validations en attente, indicateurs finance (selon branchement données réelles vs démo). |
| **Urgent aujourd’hui** | Raccourcis vers tâches et éléments à traiter dans la journée. |
| **Production** | Aperçu du pipeline vidéo (statuts, charge). |
| **Équipe** | Activité ou charge par rôle (selon version affichée). |
| **Notifications** | Accès rapide au centre de notifications. |
| **Activité récente** | Fil issu des **journaux d’activité** (créations, changements de statut importants). |

> **Important.** Si un chiffre semble « trop rond » ou incohérent avec votre CRM, vérifier s’il provient d’un **jeu de démonstration** — la priorité reste les **listes détaillées** (tâches, factures, vidéos).

### 2.4 Calendrier éditorial (`/editorial`)

Module dédié au **planning de contenus** (ligne éditoriale, dates de publication prévues). Le niveau de maturité fonctionnelle dépend de la façon dont votre agence **alimente** les données (projets, vidéos, métadonnées). En cas de doute, croiser avec **Vidéos** et **Tâches** pour la semaine en cours.

> **Important.** Valider avec votre **chef de projet** ou **admin** si certaines vues éditoriales sont encore **partielles** ou synchronisées manuellement.

### 2.5 Module Équipe (`/team`)

- **Tout le monde** (employé connecté) voit l’annuaire, la charge et les filtres.
- **Administrateur seul** : bouton **Nouveau membre**, changement de **rôle**, **désactivation**, **archivage**, tentative de **suppression** (souvent remplacée par l’archivage si l’historique métier existe).
- Les **collaborateurs inactifs ou archivés** ne reçoivent **pas** de nouvelles tâches ou vidéos assignées depuis les formulaires.
- Rôle **Finance** : même type d’accès **devis / factures / paiements** que le **commercial** au niveau des **autorisations applicatives** (voir matrice ci-dessous).

---

## 3. Rôles utilisateurs

Rôles dans la fiche employé : **admin**, **project_manager**, **editor**, **cameraman**, **developer**, **designer**, **seo**, **commercial**, **community_manager**, **finance**. Le profil **client** existe dans le système mais le client utilise uniquement le **portail** (lien avec jeton), pas un compte dans l’app interne.

### 3.1 Matrice des droits (application)

Les colonnes ci-dessous suivent le fichier **`capabilities.ts`** (autorisations côté application). Les **règles de la base de données** peuvent être **plus strictes** sur certains points — voir l’encadré **Rapports** au §2.2.

**Légende :** ✓ = autorisé · — = non · **Lecture** = consulter selon les droits du compte.

| Capacité | Admin | Chef de projet | Commercial | Finance | Autres rôles |
|----------|:-----:|:--------------:|:----------:|:-------:|:------------:|
| Supprimer un client | ✓ | — | — | — | — |
| Créer / modifier un client | ✓ | ✓ | ✓ | — | Lecture |
| Gérer le portail (jeton, actif / inactif) | ✓ | ✓ | — | — | — |
| Devis : créer / modifier | ✓ | — | ✓ | ✓ | Lecture |
| Factures : voir | ✓ | ✓ | ✓ | ✓ | Lecture |
| Factures : créer / modifier | ✓ | — | ✓ | ✓ | — |
| Paiements : saisie | ✓ | — | ✓ | ✓ | — |
| Rapports : bouton « Nouveau » dans l’interface | ✓ | ✓ | ✓ | — | — |
| Rapports : enregistrement effectif (base) | ✓ | ✓ | Voir §2.2 | — | — |
| Documents : ajout / archivage | ✓ | ✓ | ✓ | — | — |
| Supprimer une tâche ou une vidéo | ✓ | ✓ | — | — | — |
| Gérer l’équipe (fiches, rôles, archivage) | ✓ | — | — | — | — |
| Paramètres agence (identité, facturation par défaut) | ✓ écriture | lecture | lecture | lecture | lecture |

> **Important.** Les **règles de la base de données** complètent cet écran : ne jamais tenter de contourner les droits (partage de compte, manipulation technique).

---

## Annexe A — Quick Start Admin

**Objectif :** les **7** actions utiles le premier jour (environ **10 minutes**).

1. **Connexion** → vérifier l’accès au tableau de bord.  
2. **Paramètres** → compléter l’identité d’agence et vérifier l’onglet **Intégrations** (messagerie automatique, rappels planifiés).  
3. **Équipe** → tester **Nouveau membre** (une fiche **sans compte de connexion** au départ est normale).  
4. **Clients** → ouvrir une fiche → **Portail** → copier le **lien complet** à envoyer au client.  
5. **Devis** → ouvrir un exemple → **PDF**.  
6. **Factures** ou **Paiements** → ouvrir un exemple pour comprendre le flux.  
7. **Paramètres → Notifications** → régler les **e-mails de rappel** pour votre compte.

---

## Annexe B — Quick Start Équipe

**Objectif :** **5** gestes pour démarrer (tout profil, **~5 minutes** la première fois).

1. **Tableau de bord** + **Notifications** : voir ce qui est urgent.  
2. **Tâches** : mettre à jour **statut** et **échéance** (ou vue **Calendrier tâches**).  
3. **Vidéos** (si vous en avez) : statut et liens **aperçu / version finale**.  
4. **Paramètres** : thème clair / sombre et **préférences de rappels**.  
5. Message **Accès refusé** : ce n’est pas une panne — demander à l’admin si un droit manque.

| Métier | Où cliquer en premier |
|--------|-------------------------|
| Chef de projet | Tâches, Projets, Vidéos, Clients |
| Commercial ou **Finance** | Clients, Devis, Factures, Paiements |
| Monteur / caméraman | Vidéos, Tâches |
| Design, SEO, communauté… | Tâches, Projets |

---

## 4. Formation administrateur

### 4.1 Périmètre

- Gouvernance des **comptes** employés (connexion + fiche dans **Équipe** ; liaison du compte de connexion peut se faire plus tard côté hébergeur).
- **Clients** : suppression définitive réservée à l’admin ; archivage / statut pour les autres rôles habilités.
- **Portail** : réinitialisation des jetons, activation / désactivation.
- **agency_settings** : identité agence, préfixes, devise, TVA par défaut, URL portail, branding (édition **admin uniquement** dans l’app).
- **Sécurité** : rotation des **clés secrètes** serveur et du **secret des tâches planifiées** ; checklist **SECURITY_CHECKLIST.md** du projet.
- **Journaux** : consultation de l’**historique d’activité** (aperçu tableau de bord + fiches client / devis / **employé**).
- **Équipe** : création de fiches, rôles (dont **Finance**), archivage, protection du dernier administrateur.

### 4.2 Vérifications régulières

| Fréquence | Contrôle |
|-----------|----------|
| Hebdo | Jetons portail actifs, factures en retard, erreurs cron |
| Mensuel | Revue rôles employés, exports sauvegardes DB (hors scope app) |
| Incident | Révocation clé si fuite, désactivation portail si abus |

---

## 5. Formation équipe

- **Commercial / Finance** : devis, factures, paiements (voir matrice §3.1) ; portefeuille clients pour le commercial.
- **Chef de projet** : portefeuille clients et projets, rapports (enregistrement OK), coordination tâches et vidéos.
- **Monteur / caméraman** : vidéos assignées, deadlines, statuts publics vs internes.
- **Développeur / designer / SEO / community** : tâches et projets ; respect du champ **interne** sur commentaires et documents.
- Tous : **notifications**, **préférences de rappels** (emails cron) dans **Paramètres**.

---

## 6. Workflow client complet

1. **Prospect / active** : création fiche **Clients** (secteur, contact, contrat, quota vidéo…).
2. **Projets** : créer **projet client** lié ; suivre **progress** / **deadline**.
3. **Portail** : générer lien sécurisé ; communiquer **URL complète** au client.
4. **Livrables** : vidéos et documents marqués **visibles client** quand prêt.
5. **Facturation** : devis accepté → conversion **facture** (si process) ; facture **visible client** si besoin.

> **Important.** Les **notes internes** client ne doivent jamais être dupliquées dans des champs « visibles portail ».

### 6.1 Projets internes (`/internal`)

Les **projets internes** servent au pilotage **sans facturation client directe** : veille, R&D, contenus maison, outils internes. Ils ne remplacent pas les **projets clients** pour le suivi contractuel.

| Usage | Recommandation |
|-------|----------------|
| Jalons & deadlines | Aligner avec la **charge réelle** de l’équipe pour éviter les conflits avec les projets facturés. |
| Tâches | Lier des **tâches** aux projets internes pour la visibilité hebdomadaire. |
| Portail | Le portail client **ne liste pas** les projets internes — réservé au back-office. |

---

## 7. Workflow production vidéo

| Phase | Action dans Supra v. |
|-------|----------------------|
| Idée / brief | Créer ou mettre à jour la **vidéo** ; renseigner client, deadline, rôles (monteur, cadreur). |
| Production | Faire évoluer les **statuts** (tournage, montage, review interne…). |
| Envoi client | Passer en statut type **envoyé au client** ; renseigner **preview_url** / **final_url** si disponibles. |
| Validation | Le **client** valide ou demande révision **depuis le portail** ; l’équipe reçoit **notifications** et emails selon préférences. |
| Publication | Statut **publié** ; comptabilisation quota mois en cours sur le portail si configuré. |

> **À ne pas faire.** Ne pas exposer au portail une vidéo encore en **brouillon interne** sans vérifier statuts et champs publics.

---

## 8. Workflow tâches

- Création depuis **Tâches** ou raccourcis dashboard ; assignation **collaborateur**, **priorité**, **échéance**.
- **Calendrier** : `/tasks/calendar` pour vue temporelle.
- Statuts : à faire → en cours → review → **terminé** / **archivé** / **bloqué** (bloqué peut déclencher alerte équipe).
- Suppression réservée **admin** et **chef de projet**.

### Checklist quotidienne tâches

- [ ] Trier par **urgent** et **échéance aujourd’hui**
- [ ] Mettre à jour les tâches terminées
- [ ] Déclarer les **bloquages** avec commentaire utile

---

## 9. Workflow devis

1. **Nouveau devis** : client, lignes, TVA, remises, texte stratégique, **visible portail** si le client doit voir la proposition en ligne. (**Admin**, **Commercial** ou **Finance** peuvent éditer — pas le chef de projet seul, sauf s’il a aussi un autre rôle.)
2. **PDF premium** : téléchargement `/api/quotes/[id]/pdf` (session employé).
3. **Envoi** : passage au statut **envoyé** (déclenchements notifications selon logique métier).
4. **Portail** : si **visible** + **envoyé**, le client peut **accepter** ou **refuser** (sans voir notes internes ni marges cachées dans le PDF portal).
5. **Conversion** : devis **accepté** → **convertir en facture** (création facture + lien devis).

> **Important.** Le PDF **portail** et les endpoints **portail** filtrent les données sensibles — ne pas envoyer au client des captures d’écran de l’interface interne à la place du PDF officiel.

---

## 10. Workflow factures & paiements

| Étape | Détail |
|-------|--------|
| Création | Facture brouillon, lignes, échéance, **visible client** optionnel |
| Envoi | Statut **envoyée** ; suivi **en retard** (cron **overdue** + actions manuelles) |
| Paiement | Saisie dans **Paiements** ; recalcul partiel / soldé sur la facture |
| PDF | `/api/invoices/[id]/pdf` |

**Rôles :** création / modification des factures et des paiements : **admin**, **commercial** et **Finance** (voir §3.1).

---

## 11. Workflow documents

| Mode | Description |
|------|-------------|
| Fichier | Upload vers bucket **documents** (service role serveur) ; chemin stocké ; ouverture via **URL signée** courte durée |
| URL fichier | Lien direct (CDN, fichier public) |
| Lien externe | Drive, Notion, etc. |
| Portail | Visible seulement si **visible_to_client** coché ; documents internes **jamais** listés côté portail |
| Archivage | Soft-archive (`archived_at`) ; liste principale filtrable « inclure archivés » |

> **Si Storage non configuré** : l’interface affiche un **avertissement** ; l’upload fichier est désactivé mais **URL / lien externe** fonctionnent.

---

## 12. Workflow rapports

1. Créer un **rapport** lié à un client : période, résumé, travaux réalisés (highlights), suites, recommandations.
2. **Visible client** : contrôle l’affichage portail + génération **PDF portail** autorisée.
3. **PDF interne** : `/api/reports/[id]/pdf` pour équipe authentifiée.
4. **PDF portail** : `/api/portal/reports/[id]/pdf` avec `clientId` + `token` ; **refus** si non visible ou token invalide.
5. **WhatsApp** : champ texte dédié pour copier-coller un résumé (hors automation WhatsApp Business dans ce guide).

---

## 13. Portail client

### 13.1 URL type

`https://app.suprav3.com/portal/client/[CLIENT_UUID]?token=[JETON_HEX]`

### 13.2 Contenu typique

- Quota vidéo mois en cours (si quota > 0)
- Vidéos avec **aperçu / lien final** si renseignés
- **Validations** (approuver / demander révision) selon statut
- **Devis** visibles + **PDF** + acceptation / refus
- **Factures** visibles (montants / statuts publics)
- **Documents** et **rapports** filtrés (pas de données internes)
- **Projets** (aperçu simplifié)

### 13.3 Gestion côté agence

- **Clients → Portail** ou **Portal-admin** : état actif, compteur d’accès, **régénération** du jeton (invalide l’ancien lien).

> **À ne pas faire.** Ne jamais publier le jeton sur un canal public ; traiter le token comme un **secret faible** partagé avec une personne physique.

---

## 14. Notifications & rappels

- **In-app** : `/notifications` ; liens vers entités (tâche, facture, vidéo…).
- **Création** : événements métier (ex. devis accepté, facture envoyée, validation client).
- **Préférences utilisateur** : dans **Paramètres** — activer / désactiver **emails cron** et sous-types (matin, soir, alertes échéances).

---

## 15. Emails automatiques

Fournisseur typique : **Resend** (clé serveur `RESEND_API_KEY`). Aperçu HTML en **développement** : `/api/dev/email-preview` (**désactivé en production** — ne pas s’en servir comme preuve client).

### 15.1 Planification des crons (`vercel.json` — Vercel Hobby)

Les fuseaux horaires des crons Vercel sont en **UTC** ; ajuster mentalement selon votre fuseau (ex. CET = UTC+1 en hiver).

**Plan Hobby** : une seule tâche planifiée pour limiter les slots Vercel :

| Route API | Expression cron (dépôt) | Rôle |
|-----------|---------------------------|------|
| `/api/cron/daily` | `30 7 * * 1-5` — lun–ven 07:30 UTC | Enchaîne : factures en retard → alertes échéance (1×/jour) → rappels matin |

Les routes **unitaires** existent toujours pour tests ou **Vercel Pro** : `morning-reminders`, `overdue-invoices`, `deadline-alerts`, `evening-summary`. Sur Pro, on peut par exemple ajouter `evening-summary` le soir ou `deadline-alerts` toutes les 2 h (voir `DEPLOYMENT.md`).

> **Important.** Après chaque déploiement majeur, **relire** `vercel.json` : les chemins et horaires peuvent changer.

Chaque appel doit inclure le **secret convenu** pour les tâches planifiées (voir configuration du projet — en-tête d’autorisation attendu par l’application).

### 15.2 Préférences par utilisateur

Dans **Paramètres → Notifications**, chaque collaborateur peut couper les **emails** tout en gardant des notifications in-app, ou désactiver un type de rappel (matin, soir, alertes échéances).

| Flux | Description |
|------|-------------|
| Rappel matinal | Tâches du jour, urgentes, retards |
| Bilan soir | Tâches complétées, reste à faire, demain |
| Alertes échéances | Rappels 24h, retards, factures / devis sensibles |
| Factures en retard | Traitement automatique de statuts selon logique métier |

> **Important.** Sans **secret de cron** configuré sur l’hébergement et sans **planification** des appels (ex. Vercel Cron), **aucun** de ces envois n’est garanti — l’application reste utilisable à la main.

> **À ne pas faire.** Ne pas désactiver Resend en production sans prévenir l’équipe si les rappels font partie du contrat de service interne.

---

## 16. Paramètres (Settings)

| Zone | Contenu |
|------|---------|
| Apparence | Thème clair / sombre / système (stockage local navigateur) |
| Profil agence | Données **DB** `agency_settings` (admin écrit ; autres lisent) |
| Facturation défaut | Préfixes, devise, TVA %, conditions type |
| Notifications | Préférences personnelles (emails + types de rappels) |
| Sécurité | Email, rôle, extrait identifiant session, déconnexion |
| Intégrations | État des **connexions techniques** (base de données, messagerie, rappels planifiés, URL du site) |

### 16.1 Journaux d’activité (activity logs)

Les actions sensibles et événements métier sont enregistrés **automatiquement côté serveur** : création ou mise à jour de clients, devis, factures, documents, validations, changements sur l’équipe, etc.

| Où consulter | Contenu typique |
|--------------|-----------------|
| **Dashboard** | Fil **activité récente** (aperçu) |
| **Fiches détail** | Historique contextuel sur client, devis, etc. (selon écran) |
| **Paramètres / audit** | Pas d’export CSV dédié dans l’app par défaut — prévoir export SQL / outil BI si besoin légal |

> **Important.** Les journaux servent à la **traçabilité interne** ; ne pas les confondre avec les journaux techniques de **l’hébergeur** (serveur / infrastructure).

Feedback UI : messages **succès / erreur / chargement** sur les formulaires agence et notifications.

---

## 17. Sécurité

| Sujet | Pratique |
|-------|----------|
| Auth employés | Supabase Auth + session cookie ; middleware protège les routes |
| RLS | Politiques Postgres sur les tables métier ; **service role** uniquement serveur |
| Portail | Validation **token** serveur ; pas d’accès **anon** aux tables sensibles |
| CSP | En-têtes sur Vercel ; ajuster si nouveau domaine tiers nécessaire |
| Secrets | Jamais dans le dépôt ; rotation si fuite |
| PDF / Storage | Pas de `service_role` dans le navigateur ; liens Storage **signés** |

Document de référence projet : `SECURITY_CHECKLIST.md`.

---

## 18. Routines quotidiennes

### Matin (équipe)

- [ ] Ouvrir **Dashboard** + **Notifications**
- [ ] Traiter **tâches** du jour et **urgentes**
- [ ] Vérifier **vidéos** en validation client

### Journée

- [ ] Mettre à jour **statuts** au fil de l’eau
- [ ] Répondre aux **demandes de révision** portail

### Soir

- [ ] Clôturer les tâches terminées
- [ ] Noter les reports pour le lendemain

### Semaine (PM / admin)

- [ ] Revue **projets** en retard
- [ ] Relances **factures** / **devis** expirants

### Mois (admin / finance)

- [ ] Synthèse facturation
- [ ] Vérifier **paramètres agence** et **conformité** accès

---

## 19. Checklists par rôle

### Admin

- [ ] Secrets et crons OK
- [ ] Sauvegarde / politique suppression clients
- [ ] Revue **activity logs** si audit

### Chef de projet

- [ ] Portails à jour pour les clients actifs
- [ ] Jalons projets / vidéos cohérents
- [ ] Tâches critiques assignées

### Commercial

- [ ] Devis à jour et PDF envoyés
- [ ] Factures visibles client quand nécessaire
- [ ] Paiements saisis

### Finance

- [ ] Factures et paiements à jour (même famille de droits que le commercial sur ces écrans)
- [ ] Relances cohérentes avec le commercial

### Monteur / caméraman

- [ ] Deadlines à jour
- [ ] URLs preview/final renseignées au bon moment

### Développeur / design / SEO / community

- [ ] Tâches priorisées
- [ ] Commentaires **internes** vs **client** respectés

---

## 20. Cas pratiques

### Cas A — Nouveau contrat récurrent

1. Client **active**, quota vidéo renseigné.  
2. Créer **projet** + premières **vidéos** + **tâches** de lancement.  
3. Générer **portail** ; envoyer lien.  
4. Premier **rapport** mensuel si offert.

### Cas B — Devis signé côté portail

1. Devis **envoyé** et **visible**.  
2. Client **accepte** sur le portail.  
3. Notification équipe ; **convertir** en facture dans l’app.

### Cas C — Document sensible

1. Ajouter fichier ou lien ; **ne pas** cocher visible client.  
2. Vérifier que le portail ne liste pas le document.

---

## 21. Erreurs fréquentes

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| Lien portail « invalide » | Jeton régénéré ou portail désactivé | Régénérer et renvoyer |
| Upload document impossible | `SUPABASE_SERVICE_ROLE_KEY` ou buckets manquants | Vérifier env + migration Storage |
| 403 dans l’app | Rôle insuffisant | Lire `/access-denied` ; contacter admin |
| Pas d’email de rappel | Resend non configuré ou préférences utilisateur | Settings intégrations + préférences |
| PDF vide / erreur | Données manquantes ou session expirée | Reconnexion ; vérifier entité existe |
| Erreur à l’**enregistrement** d’un rapport (profil commercial) | L’interface autorise la création, la base n’autorise l’écriture qu’au PM / admin | Demander à un **chef de projet** ou **admin** de créer le rapport (voir §2.2) |

---

## 22. Glossaire

| Terme | Définition |
|-------|------------|
| RLS | *Row Level Security* — règles fines dans la base de données : qui peut lire ou modifier quelle ligne |
| Jeton portail | Code secret rattaché au client, présent dans le lien du portail ; sans lui, le lien ne fonctionne pas |
| URL signée (fichiers) | Lien de téléchargement **temporaire** pour un fichier privé |
| visible_to_client | Case ou réglage : le client **voit** ou non l’élément sur le portail |
| Cron | Tâche **planifiée** (souvent sur l’hébergement) qui appelle l’application pour envoyer des rappels |

---

## 23. Conclusion

Supra v. Agency OS centralise **pipeline commercial**, **production** et **relation client** dans une seule interface sécurisée. Ce guide doit être complété par vos **process internes** (naming, validations humaines, SLA). Pour toute évolution majeure du code, mettre à jour ce document et la **SECURITY_CHECKLIST**.

**Contacts internes :** définir un **référent produit** (admin) et un **référent technique** (hébergement / base de données) dans votre agence.

---

*Document généré pour la formation Supra v. — ne pas diffuser le jeton portail ni les secrets d’environnement.*
