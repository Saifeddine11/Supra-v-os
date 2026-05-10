/**
 * Données fictives pour le tableau de bord — à remplacer par Supabase (Deliverable 3+).
 * Centralisé et typé pour éviter le bruit dans les composants UI.
 */

import { formatAgencyMoneyCompact } from '@/lib/money/format-money';

export type TrendDirection = 'up' | 'down' | 'flat';

export interface StatCardData {
  id: string;
  title: string;
  value: string;
  subtitle?: string;
  /** Lien sous le sous-titre (ex. admin → paramètres objectif). */
  subtitleLink?: { href: string; label: string };
  trend?: { direction: TrendDirection; label: string };
  tone?: 'default' | 'positive' | 'negative' | 'warning';
}

/** Valeurs factices des cartes CA / encaissé / en attente — recalibrées sur la devise Paramètres. */
const ILLUSTRATIVE_STAT_MONEY: Record<string, number> = {
  rev: 186_400,
  collected: 142_200,
  pending: 44_200,
};

export function dashboardStatsWithIllustrativeMoney(
  stats: StatCardData[],
  agencyCurrency: string
): StatCardData[] {
  return stats.map((s) => {
    const n = ILLUSTRATIVE_STAT_MONEY[s.id];
    if (n == null) return s;
    return { ...s, value: formatAgencyMoneyCompact(n, agencyCurrency) };
  });
}

export interface UrgentItem {
  id: string;
  type: string;
  title: string;
  detail: string;
  severity: 'high' | 'medium';
}

export interface VideoRowMock {
  id: string;
  title: string;
  client: string;
  status: string;
  tone?: 'default' | 'warning' | 'success';
}

export interface TaskRowMock {
  id: string;
  title: string;
  assignee: string;
  due: string;
  priority: 'urgent' | 'high' | 'normal';
  overdue?: boolean;
}

export interface WorkloadMember {
  name: string;
  role: string;
  percent: number;
}

export interface FinanceSnapshot {
  monthlyRevenue: string;
  monthlyTarget: string;
  collected: string;
  pending: string;
  unpaidInvoicesCount: number;
  paidInvoicesCount: number;
  pendingInvoicesCount: number;
  overdueInvoicesCount: number;
  acceptedQuotes: number;
  pendingQuotes: number;
  /** Sous-titre objectif : progression réelle ou « non défini » — pas de pourcentage fantaisiste. */
  targetDetail?: string | null;
  /** 0–100 si objectif CA > 0 et défini, sinon null. */
  targetProgressPercent?: number | null;
}

export interface RevenueChartPoint {
  month: string;
  revenue: number;
  target: number;
}

export interface ClientFollowMock {
  id: string;
  name: string;
  note: string;
  tag: 'active' | 'follow-up' | 'portal' | 'invoice';
}

export interface ProjectRowMock {
  id: string;
  name: string;
  progress: number;
  type: 'client' | 'internal';
  blocker?: string;
}

export interface NotificationMock {
  id: string;
  title: string;
  time: string;
  type: 'validation' | 'revision' | 'invoice' | 'task' | 'report';
}

export const DASHBOARD_STATS: StatCardData[] = [
  {
    id: 'rev',
    title: 'CA du mois',
    value: '186 400 MAD',
    subtitle: 'vs mois précédent',
    trend: { direction: 'up', label: '+12 %' },
    tone: 'positive',
  },
  {
    id: 'target',
    title: 'Objectif mensuel (CA)',
    value: '—',
    subtitle: 'Chargement depuis les paramètres agence',
    trend: undefined,
  },
  {
    id: 'collected',
    title: 'Encaissé',
    value: '142 200 MAD',
    trend: { direction: 'up', label: '+8 %' },
    tone: 'positive',
  },
  {
    id: 'pending',
    title: 'En attente',
    value: '44 200 MAD',
    trend: { direction: 'down', label: '3 factures' },
    tone: 'warning',
  },
  {
    id: 'unpaid',
    title: 'Factures impayées',
    value: '6',
    subtitle: 'dont 2 en retard',
    trend: { direction: 'down', label: 'À relancer' },
    tone: 'negative',
  },
  {
    id: 'clients',
    title: 'Clients actifs',
    value: '14',
    subtitle: 'sous contrat',
    trend: { direction: 'up', label: '+2' },
  },
  {
    id: 'proj',
    title: 'Projets en cours',
    value: '11',
    subtitle: 'client + interne',
  },
  {
    id: 'vid-month',
    title: 'Vidéos à produire',
    value: '18',
    subtitle: 'ce mois-ci',
  },
  {
    id: 'vid-delivered',
    title: 'Vidéos livrées',
    value: '9',
    subtitle: 'ce mois-ci',
    tone: 'positive',
  },
  {
    id: 'urgent-tasks',
    title: 'Tâches urgentes',
    value: '5',
    tone: 'warning',
  },
  {
    id: 'overdue-tasks',
    title: 'Tâches en retard',
    value: '3',
    tone: 'negative',
  },
  {
    id: 'validations',
    title: 'Validations client',
    value: '4',
    subtitle: 'en attente',
    tone: 'warning',
  },
];

export function illustrativeUrgentItems(agencyCurrency: string): UrgentItem[] {
  return [
    {
      id: '1',
      type: 'Facture',
      title: `Villa Luxe Marrakech — ${formatAgencyMoneyCompact(22_000, agencyCurrency)}`,
      detail: 'Échéance dépassée de 6 jours',
      severity: 'high',
    },
    {
      id: '2',
      type: 'Deadline',
      title: 'Livraison teaser Emara Estates',
      detail: 'J-2 — montage final',
      severity: 'high',
    },
    {
      id: '3',
      type: 'Validation',
      title: 'Room Tour Deluxe Suite — Riad Atlas',
      detail: 'En attente de validation client',
      severity: 'medium',
    },
    {
      id: '4',
      type: 'Tâche',
      title: 'Script VO — Accrocar',
      detail: 'Bloquée — contenu manquant',
      severity: 'medium',
    },
    {
      id: '5',
      type: 'Client',
      title: 'Africa Beauty — quota vidéo',
      detail: '2 créations restantes ce trimestre',
      severity: 'medium',
    },
    {
      id: '6',
      type: 'Équipe',
      title: 'Yasmine — charge 85 %',
      detail: 'Surcharge prévue cette semaine',
      severity: 'high',
    },
    {
      id: '7',
      type: 'Rapport',
      title: 'Rapport mensuel Restaurant Le Jardin',
      detail: 'À envoyer avant vendredi',
      severity: 'medium',
    },
  ];
}

export const VIDEOS_BY_FOCUS: VideoRowMock[] = [
  {
    id: 'v1',
    title: 'Dessert Signature',
    client: 'Restaurant Le Jardin',
    status: 'Montage',
  },
  {
    id: 'v2',
    title: 'Room Tour Deluxe Suite',
    client: 'Riad Atlas',
    status: 'Validation client',
    tone: 'warning',
  },
  {
    id: 'v3',
    title: 'Villa Palmeraie Tour',
    client: 'Villa Luxe Marrakech',
    status: 'Tournage planifié',
  },
  {
    id: 'v4',
    title: 'Haircare Routine',
    client: 'Africa Beauty',
    status: 'Publié',
    tone: 'success',
  },
  {
    id: 'v5',
    title: 'Lounge Bar Sunset',
    client: 'Riad Atlas',
    status: 'Révision client',
    tone: 'warning',
  },
];

export const VIDEO_STATUS_COUNTS: { label: string; count: number }[] = [
  { label: 'Idée / brief', count: 4 },
  { label: 'Production', count: 6 },
  { label: 'Montage', count: 5 },
  { label: 'Validation', count: 4 },
  { label: 'Publié', count: 12 },
];

export const TASKS_TODAY: TaskRowMock[] = [
  {
    id: 't1',
    title: 'Brief shooting — Emara Estates',
    assignee: 'Karim',
    due: 'Aujourd’hui 16h',
    priority: 'urgent',
  },
  {
    id: 't2',
    title: 'Étalonnage — Dessert Signature',
    assignee: 'Yasmine',
    due: 'Aujourd’hui',
    priority: 'high',
  },
  {
    id: 't3',
    title: 'Repérage drone — Villa Luxe',
    assignee: 'Mohamed',
    due: 'Demain 09h',
    priority: 'normal',
  },
];

export const TASKS_OVERDUE: TaskRowMock[] = [
  {
    id: 'o1',
    title: 'Légendes SOCIAL — Accrocar',
    assignee: 'Karim',
    due: 'Hier',
    priority: 'high',
    overdue: true,
  },
  {
    id: 'o2',
    title: 'Export master — Lounge Bar Sunset',
    assignee: 'Yasmine',
    due: 'Il y a 2 jours',
    priority: 'urgent',
    overdue: true,
  },
];

export const TEAM_WORKLOAD: WorkloadMember[] = [
  { name: 'Yasmine', role: 'Monteuse', percent: 85 },
  { name: 'Karim', role: 'Community', percent: 40 },
  { name: 'Mohamed', role: 'Caméraman', percent: 70 },
  { name: 'Sif Eddine', role: 'Développeur', percent: 65 },
];

/** Snapshot finance d’illustration — montants alignés sur la devise Paramètres agence. */
export function illustrativeFinanceSnapshot(agencyCurrency: string): FinanceSnapshot {
  return {
    monthlyRevenue: formatAgencyMoneyCompact(186_400, agencyCurrency),
    monthlyTarget: 'Non défini',
    collected: formatAgencyMoneyCompact(142_200, agencyCurrency),
    pending: formatAgencyMoneyCompact(44_200, agencyCurrency),
    unpaidInvoicesCount: 6,
    paidInvoicesCount: 14,
    pendingInvoicesCount: 5,
    overdueInvoicesCount: 2,
    acceptedQuotes: 3,
    pendingQuotes: 2,
    targetDetail: null,
    targetProgressPercent: null,
  };
}

export const REVENUE_CHART: RevenueChartPoint[] = [
  { month: 'Juin', revenue: 142000, target: 180000 },
  { month: 'Juil.', revenue: 158000, target: 190000 },
  { month: 'Août', revenue: 171200, target: 200000 },
  { month: 'Sept.', revenue: 165000, target: 210000 },
  { month: 'Oct.', revenue: 179400, target: 210000 },
  { month: 'Nov.', revenue: 186400, target: 220000 },
];

export const CLIENTS_FOLLOW: ClientFollowMock[] = [
  { id: 'c1', name: 'Restaurant Le Jardin', note: 'Campagne Q4 — rythme OK', tag: 'active' },
  { id: 'c2', name: 'Riad Atlas', note: 'Relance validation suite parent', tag: 'follow-up' },
  { id: 'c3', name: 'Villa Luxe Marrakech', note: 'Facture en retard', tag: 'invoice' },
  { id: 'c4', name: 'Africa Beauty', note: 'Portail actif — 2 retours', tag: 'portal' },
  { id: 'c5', name: 'Emara Estates', note: 'Site + pack vidéo', tag: 'active' },
  { id: 'c6', name: 'Accrocar', note: 'Branding — livrables semaine prochaine', tag: 'active' },
];

export const PROJECTS_ONGOING: ProjectRowMock[] = [
  { id: 'p1', name: 'Supra v. Website', progress: 65, type: 'internal' },
  { id: 'p2', name: 'Supra v. SEO', progress: 45, type: 'internal', blocker: 'Contenu longue traîne' },
  { id: 'p3', name: 'Emara Estates Website', progress: 80, type: 'client' },
  { id: 'p4', name: 'Accrocar Branding', progress: 55, type: 'client' },
  { id: 'p5', name: 'Invoice Automation', progress: 30, type: 'internal' },
];

export const RECENT_NOTIFICATIONS: NotificationMock[] = [
  {
    id: 'n1',
    title: 'Validation requise — Room Tour Deluxe Suite',
    time: 'Il y a 42 min',
    type: 'validation',
  },
  {
    id: 'n2',
    title: 'Révision demandée — Lounge Bar Sunset',
    time: 'Il y a 2 h',
    type: 'revision',
  },
  {
    id: 'n3',
    title: 'Facture en retard — Villa Luxe Marrakech',
    time: 'Il y a 5 h',
    type: 'invoice',
  },
  {
    id: 'n4',
    title: 'Tâche assignée — Brief shooting Emara',
    time: 'Hier',
    type: 'task',
  },
  {
    id: 'n5',
    title: 'Rapport mensuel — Restaurant Le Jardin',
    time: 'Hier',
    type: 'report',
  },
];

export const MOCK_INVOICES_PREVIEW = [
  { client: 'Restaurant Le Jardin', amountValue: 8000, status: 'En attente' },
  { client: 'Villa Luxe Marrakech', amountValue: 22_000, status: 'En retard' },
  { client: 'Africa Beauty', amountValue: 4500, status: 'Payée' },
  { client: 'Accrocar', amountValue: 15_000, status: 'Brouillon' },
];
