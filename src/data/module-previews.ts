/** Textes des pages module (placeholder) — remplaçables par vraies vues métier. */

export interface ModulePreview {
  title: string;
  description: string;
  previewPoints: string[];
  primaryCta?: { href: string; label: string };
}

export const MODULE_PREVIEWS: Record<string, ModulePreview> = {
  clients: {
    title: 'Clients',
    description:
      'Carnet clients, contrats, statuts et accès portail. Vue consolidée des comptes actifs et des relances à prévoir.',
    previewPoints: [
      'Fiches client avec contacts et secteurs',
      'Pipeline prospect → actif',
      'Liens vers projets et factures',
      'Activation portail sécurisé par token',
    ],
  },
  videos: {
    title: 'Production vidéo',
    description:
      'Suivi des briefs, tournages, montages et validations. Tableaux Kanban et états alignés sur votre workflow agence.',
    previewPoints: [
      'Statuts vidéo de l’idée à la publication',
      'Charge monteurs et deadlines',
      'Versions envoyées au client',
      'Historique des révisions',
    ],
  },
  editorial: {
    title: 'Calendrier éditorial',
    description:
      'Planification des sorties par client et par plateforme, avec quotas et jalons éditoriaux.',
    previewPoints: [
      'Vue mensuelle multi-clients',
      'Quotas et thématiques',
      'Synchronisation avec la production',
    ],
  },
  tasks: {
    title: 'Tâches',
    description:
      'Liste priorisée, assignations équipe et suivi des blocages — style monday.com adapté à Supra v.',
    previewPoints: [
      'Filtres par rôle et priorité',
      'Assignation et dates d’échéance',
      'Commentaires internes',
    ],
  },
  'tasks/calendar': {
    title: 'Calendrier des tâches',
    description:
      'Vue calendaire des charges et deadlines internes pour anticiper les pics de production.',
    previewPoints: [
      'Vue semaine / mois',
      'Charge par membre',
      'Alertes surcharge',
    ],
  },
  projects: {
    title: 'Projets clients',
    description:
      'Projets rattachés aux clients : jalons, livrables, progression et risques.',
    previewPoints: [
      'Progression et jalons',
      'Liens vers vidéos et factures',
      'Vue équipe projet',
    ],
  },
  internal: {
    title: 'Projets internes',
    description:
      'Initiatives internes (site, SEO, outils) avec priorisation et suivi de temps.',
    previewPoints: [
      'Roadmap interne',
      'Priorités et owners',
      'Livrables techniques',
    ],
  },
  team: {
    title: 'Équipe',
    description:
      'Profils, rôles, charge et compétences — base pour la planification et les accès.',
    previewPoints: [
      'Rôles et permissions',
      'Capacité hebdomadaire',
      'Historique d’activité',
    ],
  },
  invoices: {
    title: 'Factures',
    description:
      'Émission PDF luxe, statuts, relances et lien avec les paiements — conforme à votre processus marocain.',
    previewPoints: [
      'Numérotation et brouillons',
      'Envoi et suivi',
      'Export comptable',
    ],
  },
  quotes: {
    title: 'Devis',
    description:
      'Propositions commerciales, acceptation client et conversion en facture en un flux.',
    previewPoints: [
      'Modèles et lignes',
      'Signature / acceptation',
      'Conversion facture',
    ],
  },
  payments: {
    title: 'Paiements',
    description:
      'Encaissements liés aux factures, méthodes de paiement et rapprochement.',
    previewPoints: [
      'Liaison facture ↔ paiement',
      'Virement, espèces, carte',
      'Soldes clients',
    ],
  },
  reports: {
    title: 'Rapports',
    description:
      'Synthèses périodiques pour clients et direction : performance, création, finance.',
    previewPoints: [
      'Rapports PDF automatiques',
      'Envoi planifié',
      'Indicateurs clés',
    ],
  },
  documents: {
    title: 'Documents',
    description:
      'Bibliothèque centralisée : contrats, masters, assets — avec contrôle d’accès.',
    previewPoints: [
      'Dossiers par client / projet',
      'Versions et tags',
      'Intégration Storage Supabase',
    ],
  },
  'portal-admin': {
    title: 'Portail clients',
    description:
      'Administration des accès portail, tokens et suivi des validations côté client.',
    previewPoints: [
      'Création et révocation de tokens',
      'Suivi des validations',
      'Branding portail',
    ],
  },
  notifications: {
    title: 'Notifications',
    description:
      'Centre de notifications in-app : validations, retards, assignations et rappels.',
    previewPoints: [
      'Priorisation',
      'Liens contextuels',
      'Préférences par rôle',
    ],
  },
  settings: {
    title: 'Paramètres',
    description:
      'Configuration agence, intégrations, préférences de facturation et sécurité.',
    previewPoints: [
      'Branding et coordonnées',
      'Intégrations email',
      'Politiques de session',
    ],
  },
};
