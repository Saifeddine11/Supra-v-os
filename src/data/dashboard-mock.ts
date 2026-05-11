/**
 * Types partagés par le tableau de bord (cartes KPI, blocs opérationnels).
 * Aucune donnée métier fictive : les listes proviennent de Supabase via les loaders.
 */

export type TrendDirection = 'up' | 'down' | 'flat';

export interface StatCardData {
  id: string;
  title: string;
  value: string;
  subtitle?: string;
  subtitleLink?: { href: string; label: string };
  trend?: { direction: TrendDirection; label: string };
  tone?: 'default' | 'positive' | 'negative' | 'warning';
}

/** Conservé pour compatibilité d’appel : plus d’injection de montants fictifs. */
export function dashboardStatsWithIllustrativeMoney(
  stats: StatCardData[],
  _agencyCurrency: string
): StatCardData[] {
  return stats;
}

export interface UrgentItem {
  id: string;
  type: string;
  title: string;
  detail: string;
  severity: 'high' | 'medium';
  /** Pastille client (hex résolu). */
  clientBrandHex?: string | null;
}

export interface VideoRowMock {
  id: string;
  title: string;
  client: string;
  clientBrandHex?: string | null;
  status: string;
  tone?: 'default' | 'warning' | 'success';
}

export interface TaskRowMock {
  id: string;
  title: string;
  assignee: string;
  due: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  overdue?: boolean;
  clientName?: string | null;
  clientBrandHex?: string | null;
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
  targetDetail?: string | null;
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
  brandHex?: string | null;
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

/** Cartes KPI par défaut : valeurs neutres, surchargées par `getDashboardSummary` / liveOverrides. */
export const DASHBOARD_STATS: StatCardData[] = [
  {
    id: 'rev',
    title: 'CA prévu du mois',
    value: '—',
    subtitle: 'Contrats clients actifs (prévisionnel)',
  },
  {
    id: 'target',
    title: 'Objectif mensuel (CA)',
    value: '—',
    subtitle: 'Paramètres agence',
  },
  {
    id: 'collected',
    title: 'Encaissé',
    value: '—',
    subtitle: 'Paiements du mois',
  },
  {
    id: 'pending',
    title: 'En attente',
    value: '—',
    subtitle: 'Reliquats factures ouvertes',
  },
  {
    id: 'unpaid',
    title: 'Factures impayées',
    value: '0',
    subtitle: 'hors brouillon / payée / annulée',
  },
  {
    id: 'clients',
    title: 'Clients actifs',
    value: '0',
    subtitle: 'sous contrat',
  },
  {
    id: 'proj',
    title: 'Projets en cours',
    value: '0',
    subtitle: 'client + interne',
  },
  {
    id: 'vid-month',
    title: 'Vidéos en pipeline',
    value: '0',
    subtitle: 'hors publié / archivé / annulé',
  },
  {
    id: 'vid-delivered',
    title: 'Vidéos livrées',
    value: '0',
    subtitle: 'mois en cours',
  },
  {
    id: 'urgent-tasks',
    title: 'Tâches urgentes',
    value: '0',
  },
  {
    id: 'overdue-tasks',
    title: 'Tâches en retard',
    value: '0',
  },
  {
    id: 'validations',
    title: 'Validations client',
    value: '0',
    subtitle: 'en attente',
  },
];
