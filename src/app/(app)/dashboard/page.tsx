import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertCircle,
  Banknote,
  Briefcase,
  CalendarCheck,
  ClipboardList,
  Clock,
  FileWarning,
  LayoutGrid,
  ListTodo,
  Target,
  Users,
  Video,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { requireAuth, type AuthContext } from '@/lib/auth/permissions';
import {
  canModifyClients,
  canModifyInvoices,
  canViewGlobalFinanceStats,
} from '@/lib/auth/capabilities';
import { navItemVisible } from '@/lib/auth/nav-policy';
import { ActionButton } from '@/components/shared/action-button';
import { SectionCard } from '@/components/shared/section-card';
import { StatCard } from '@/components/shared/stat-card';
import { UrgentToday } from '@/components/dashboard/urgent-today';
import { ProductionOverview } from '@/components/dashboard/production-overview';
import { TeamTasksSection } from '@/components/dashboard/team-tasks-section';
import { TeamLoadSection } from '@/components/dashboard/team-load-section';
import { FinanceOverview } from '@/components/dashboard/finance-overview';
import { ClientOverview } from '@/components/dashboard/client-overview';
import { ProjectOverview } from '@/components/dashboard/project-overview';
import { NotificationsPreview } from '@/components/dashboard/notifications-preview';
import { DASHBOARD_STATS, dashboardStatsWithIllustrativeMoney, type StatCardData } from '@/data/dashboard-mock';
import {
  emptyDashboardOperational,
  fetchCommercialClientsFollow,
  fetchDashboardOperational,
} from '@/lib/data/dashboard-operational';
import { financeSnapshotFromAgg, getDashboardSummary, type DashboardScope } from '@/lib/data/dashboard-stats';
import { formatAgencyMoneyCompact } from '@/lib/money/format-money';
import { listRecentNotifications } from '@/lib/data/notifications-user';
import { listDashboardActivityForVariant } from '@/lib/data/activity-logs';
import { RecentActivityPreview } from '@/components/dashboard/recent-activity-preview';
import { PersonalWorkOverview } from '@/components/dashboard/personal-work-overview';
import { getDashboardVariant, dashboardScopeFromRole, shouldLoadGlobalActivityFeed } from '@/lib/dashboard/dashboard-variant';
import { getPersonalDashboardWork } from '@/lib/data/dashboard-personal-work';
import { DashboardChartsDeferred } from './dashboard-charts-deferred';
import type { UserRole } from '@/types/database';
import { LoginPerfBeacon } from '@/components/app/login-perf-beacon';
import { PageLoadingSkeleton } from '@/components/app/page-loading-skeleton';
import { isMinimalDashboardEnabled, perfLog, perfMs, withDevTime } from '@/lib/perf/dev-time';

export const metadata: Metadata = {
  title: 'Tableau de bord',
};

const STAT_ICONS: Record<string, LucideIcon> = {
  rev: Wallet,
  target: Target,
  collected: Banknote,
  pending: Clock,
  unpaid: FileWarning,
  clients: Users,
  proj: LayoutGrid,
  'vid-month': Video,
  'vid-delivered': CalendarCheck,
  'urgent-tasks': AlertCircle,
  'overdue-tasks': ListTodo,
  validations: ClipboardList,
  'my-open': ListTodo,
  'my-overdue': AlertCircle,
  'my-urgent': AlertCircle,
  'my-today': CalendarCheck,
  'my-blocked': FileWarning,
  'my-videos-ed': Video,
  'my-videos-cam': Video,
  'my-shoots': Video,
  'my-revisions': ClipboardList,
  'my-val': ClipboardList,
  'my-proj': Briefcase,
  'my-reports': ClipboardList,
  'co-prospects': Users,
  'co-quotes-sent': FileWarning,
  'co-quotes-ok': Target,
  'co-quotes-ko': AlertCircle,
  'co-quotes-exp': Clock,
  'pm-my-due-today': CalendarCheck,
};

const FINANCE_STAT_IDS = new Set(['rev', 'target', 'collected', 'pending', 'unpaid']);

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] ?? full;
}

function roleLabel(role: UserRole | undefined) {
  return role?.replace(/_/g, ' ') ?? '—';
}

function introForDashboard(
  variant: ReturnType<typeof getDashboardVariant>,
  scope: string,
  role: UserRole | undefined
): string {
  if (scope === 'operations') {
    return 'Pilotage production : projets, tâches, équipe et livrables — sans indicateurs financiers globaux de l’agence.';
  }
  if (variant === 'individual' && role) {
    const rk = role === 'designer' ? 'developer' : role;
    if (rk === 'editor') {
      return 'Voici vos tâches, vidéos et échéances à suivre.';
    }
    if (rk === 'cameraman') {
      return 'Vos tournages, tâches et livrables assignés — priorité au terrain.';
    }
    if (rk === 'community_manager') {
      return 'Contenus, calendrier éditorial et rapports sur votre périmètre.';
    }
    if (rk === 'seo') {
      return 'Projets SEO, rapports et tâches qui vous sont confiés.';
    }
    if (rk === 'developer') {
      return 'Projets et tâches qui vous sont assignés, avec les échéances clés.';
    }
    return 'Vue centrée sur votre charge personnelle — sans journaux internes.';
  }
  if (variant === 'manager') {
    return 'Pilotage opérationnel : clients, projets, production et charge équipe. Les journaux RH et Auth ne sont pas affichés ici.';
  }
  switch (scope) {
    case 'full':
      return 'Vue globale agence : indicateurs consolidés, finance, équipe et audit des actions sensibles.';
    case 'finance':
      return 'Trésorerie et facturation : encaissements, impayés, échéances et relances — sans charge créative ni journaux RH.';
    case 'commercial':
      return 'Votre portefeuille clients, devis et factures associées. Pas d’audit technique ni de logs employés.';
    default:
      return 'Tableau de bord Supra v.';
  }
}

function commercialExtraCards(
  c: NonNullable<Awaited<ReturnType<typeof getDashboardSummary>>['commercial']>
): StatCardData[] {
  return [
    {
      id: 'co-prospects',
      title: 'Mes prospects',
      value: String(c.myProspects),
      subtitle: 'Comptes rattachés (statut prospect)',
    },
    {
      id: 'co-quotes-sent',
      title: 'Devis envoyés',
      value: String(c.quotesSent),
      subtitle: 'Statut « envoyé »',
    },
    {
      id: 'co-quotes-ok',
      title: 'Devis acceptés',
      value: String(c.quotesAccepted),
      subtitle: 'Gagnés',
      tone: 'positive',
    },
    {
      id: 'co-quotes-ko',
      title: 'Devis refusés',
      value: String(c.quotesRefused),
      subtitle: 'Perdus',
      tone: c.quotesRefused > 0 ? 'warning' : 'default',
    },
    {
      id: 'co-quotes-exp',
      title: 'Devis expirant (7 j.)',
      value: String(c.quotesExpiring),
      subtitle: 'À relancer avant échéance',
      tone: c.quotesExpiring > 0 ? 'warning' : 'default',
    },
  ];
}

function individualStatCards(role: UserRole, p: Awaited<ReturnType<typeof getDashboardSummary>>['personal']): StatCardData[] {
  const rk: UserRole = role === 'designer' ? 'developer' : role;
  const cards: StatCardData[] = [
    {
      id: 'my-open',
      title: 'Mes tâches ouvertes',
      value: String(p.myOpenTasks),
      subtitle: 'hors terminé / archivé',
    },
    {
      id: 'my-overdue',
      title: 'Mes tâches en retard',
      value: String(p.myOverdueTasks),
      subtitle: 'assignées à vous · échéance dépassée',
      tone: p.myOverdueTasks > 0 ? 'negative' : 'default',
    },
    {
      id: 'my-urgent',
      title: 'Mes tâches urgentes',
      value: String(p.myUrgentTasks),
      subtitle: 'priorité urgente',
      tone: p.myUrgentTasks > 0 ? 'warning' : 'default',
    },
    {
      id: 'my-today',
      title: 'Échéance aujourd’hui',
      value: String(p.myTasksDueToday),
      subtitle: 'tâches à clôturer',
      tone: p.myTasksDueToday > 0 ? 'warning' : 'default',
    },
  ];

  if (p.myBlockedTasks > 0) {
    cards.push({
      id: 'my-blocked',
      title: 'Tâches bloquées',
      value: String(p.myBlockedTasks),
      subtitle: 'à débloquer',
      tone: 'negative',
    });
  }

  if (rk === 'editor' || rk === 'cameraman' || rk === 'community_manager') {
    if (rk === 'editor' || rk === 'community_manager') {
      cards.push({
        id: 'my-videos-ed',
        title: 'Vidéos (montage)',
        value: String(p.myVideosAsEditor),
        subtitle: 'hors publié / archivé',
      });
    }
    if (rk === 'cameraman' || rk === 'community_manager' || rk === 'editor') {
      cards.push({
        id: 'my-videos-cam',
        title: 'Vidéos (tournage)',
        value: String(p.myVideosAsCameraman),
        subtitle: 'hors publié / archivé',
      });
    }
    if (rk === 'cameraman' || rk === 'editor') {
      cards.push({
        id: 'my-shoots',
        title: 'Tournages planifiés',
        value: String(p.myShootsPlanned),
        subtitle: 'statut tournage planifié',
        tone: p.myShootsPlanned > 0 ? 'positive' : 'default',
      });
    }
    if (rk === 'editor') {
      cards.push({
        id: 'my-revisions',
        title: 'Révisions demandées',
        value: String(p.myVideosInRevision),
        subtitle: 'retour client',
        tone: p.myVideosInRevision > 0 ? 'warning' : 'default',
      });
      cards.push({
        id: 'my-val',
        title: 'Mes validations client',
        value: String(p.myClientValidations),
        subtitle: 'en attente de validation',
        tone: p.myClientValidations > 0 ? 'warning' : 'default',
      });
    }
  }

  if (rk === 'developer' || rk === 'seo' || rk === 'community_manager') {
    cards.push({
      id: 'my-proj',
      title: 'Mes projets actifs',
      value: String(p.myProjectsActive),
      subtitle: 'chef de projet ou membre équipe',
    });
  }

  if (rk === 'seo' || rk === 'community_manager') {
    cards.push({
      id: 'my-reports',
      title: 'Rapports à envoyer',
      value: String(p.myReportsToSend),
      subtitle: 'brouillons non envoyés',
      tone: p.myReportsToSend > 0 ? 'warning' : 'default',
    });
  }

  return cards;
}

function DashboardGreetingHeader({
  fullName,
  role,
  variant,
  scope,
}: {
  fullName: string;
  role: UserRole;
  variant: ReturnType<typeof getDashboardVariant>;
  scope: DashboardScope;
}) {
  const todayLabel = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{todayLabel}</p>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Bonjour {firstName(fullName)},
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {introForDashboard(variant, scope, role)}
        </p>
        <p className="text-sm text-muted-foreground">
          Rôle :{' '}
          <span className="font-medium capitalize text-primary">{roleLabel(role)}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(() => {
          type Quick = { href: string; label: string };
          const items: Quick[] = [];
          if (canModifyClients(role)) items.push({ href: '/clients', label: 'Nouveau client' });
          if (navItemVisible('/tasks', role)) items.push({ href: '/tasks?new=task', label: 'Nouvelle tâche' });
          if (canModifyInvoices(role)) items.push({ href: '/invoices', label: 'Nouvelle facture' });
          return items.map((item, i) => (
            <ActionButton key={item.href} href={item.href} variant={i === 0 ? 'primary' : 'secondary'}>
              {item.label}
            </ActionButton>
          ));
        })()}
      </div>
    </header>
  );
}

export default async function DashboardPage() {
  const pageStart = performance.now();
  const ctx = await requireAuth();
  if (!ctx.employee) {
    redirect('/login?next=/dashboard');
  }

  const variant = getDashboardVariant(ctx.role);
  const scope = dashboardScopeFromRole(ctx.role);

  if (isMinimalDashboardEnabled()) {
    perfLog(`[perf] dashboard page total: ${perfMs(pageStart)} ms`);
    return (
      <div className="space-y-4">
        <LoginPerfBeacon label="dashboard first render" />
        <DashboardGreetingHeader
          fullName={ctx.employee.full_name}
          role={ctx.employee.role}
          variant={variant}
          scope={scope}
        />
        <p className="text-sm text-muted-foreground">
          Diagnostic login — dashboard minimal (stats, graphiques et alertes désactivés).
        </p>
      </div>
    );
  }

  perfLog(`[perf] dashboard page shell: ${perfMs(pageStart)} ms`);

  return (
    <div className="space-y-8">
      <LoginPerfBeacon label="dashboard first render" />
      <DashboardGreetingHeader
        fullName={ctx.employee.full_name}
        role={ctx.employee.role}
        variant={variant}
        scope={scope}
      />
      <Suspense fallback={<PageLoadingSkeleton titleWidth="w-56" />}>
        <DashboardLiveBody ctx={ctx} />
      </Suspense>
    </div>
  );
}

async function DashboardLiveBody({ ctx }: { ctx: AuthContext }) {
  const pageStart = performance.now();
  if (!ctx.employee) return null;

  const variant = getDashboardVariant(ctx.role);
  const wantOpsBlocks = ctx.role === 'admin' || ctx.role === 'project_manager';
  const wantCommercialFollow = ctx.role === 'commercial';

  const [dashboardActivity, personalWork, summary, dashboardNotifications, operational] = await Promise.all([
    shouldLoadGlobalActivityFeed(variant)
      ? listDashboardActivityForVariant(variant, 10).catch(() => [] as Awaited<ReturnType<typeof listDashboardActivityForVariant>>)
      : Promise.resolve([] as Awaited<ReturnType<typeof listDashboardActivityForVariant>>),
    variant === 'individual' && ctx.employee
      ? getPersonalDashboardWork(ctx.employee.id, ctx.employee.role).catch(() => ({
          tasks: [] as Awaited<ReturnType<typeof getPersonalDashboardWork>>['tasks'],
          videos: [] as Awaited<ReturnType<typeof getPersonalDashboardWork>>['videos'],
        }))
      : Promise.resolve(null),
    getDashboardSummary(ctx),
    withDevTime('notifications', () => listRecentNotifications(6, ctx)),
    wantOpsBlocks
      ? fetchDashboardOperational(ctx).catch(() => emptyDashboardOperational())
      : wantCommercialFollow
        ? fetchCommercialClientsFollow(ctx)
            .then((clientsFollow) => ({ ...emptyDashboardOperational(), clientsFollow }))
            .catch(() => emptyDashboardOperational())
        : Promise.resolve(emptyDashboardOperational()),
  ]);
  perfLog(`[perf] dashboard page total: ${perfMs(pageStart)} ms`);
  const financeSnapshot = financeSnapshotFromAgg(
    summary.finance,
    summary.agencyMonthlyGoal,
    summary.agencyDisplayCurrency
  );
  const baseStatCards = dashboardStatsWithIllustrativeMoney(DASHBOARD_STATS, summary.agencyDisplayCurrency);

  const liveOverrides: Partial<Record<string, Partial<StatCardData>>> = {
    clients: {
      value: String(summary.activeClients),
      subtitle:
        summary.scope === 'commercial'
          ? 'Clients actifs — votre portefeuille'
          : 'Clients actifs (contrat en cours)',
      trend: undefined,
    },
    'urgent-tasks': {
      title: summary.scope === 'commercial' ? 'Tâches urgentes (vous)' : 'Tâches urgentes',
      value: String(summary.urgentTasks),
      subtitle:
        summary.scope === 'commercial' || summary.scope === 'individual'
          ? 'priorité urgente qui vous est assignée'
          : 'priorité urgente, hors terminé / archivé',
      trend: undefined,
      tone: summary.urgentTasks > 0 ? 'warning' : 'default',
    },
    'overdue-tasks': {
      title:
        summary.scope === 'commercial'
          ? 'Tâches en retard (vous)'
          : summary.scope === 'operations'
            ? 'Tâches en retard (équipe)'
            : 'Tâches en retard',
      value: String(summary.overdueTasks),
      subtitle:
        summary.scope === 'commercial' || summary.scope === 'individual'
          ? 'vos échéances dépassées'
          : summary.scope === 'operations'
            ? 'toute l’équipe · hors terminé / attente client / revue'
            : 'échéance dépassée',
      trend: undefined,
      tone: summary.overdueTasks > 0 ? 'negative' : 'default',
    },
    'vid-month': {
      title: 'Vidéos en pipeline',
      value: String(summary.activeVideos),
      subtitle:
        summary.scope === 'individual'
          ? 'vos vidéos en cours (rôle production)'
          : 'hors publié / archivé / annulé',
      trend: undefined,
    },
    'vid-delivered': {
      title: 'Vidéos livrées',
      value: String(summary.videosPublishedThisMonth),
      subtitle: 'publiées — mois en cours (updated_at)',
      trend: undefined,
      tone: 'positive',
    },
    proj: {
      title: summary.scope === 'individual' ? 'Mes projets actifs' : 'Projets en cours',
      value: String(summary.projectsInProgress),
      subtitle:
        summary.scope === 'individual'
          ? 'chef de projet ou membre équipe'
          : 'projets en in_progress / attente client / review',
      trend: undefined,
    },
    validations: {
      title: summary.scope === 'individual' ? 'Mes validations' : 'Validations client',
      value: String(summary.clientValidationsPending),
      subtitle:
        summary.scope === 'individual'
          ? 'vos vidéos en validation client'
          : 'vidéos en validation ou envoyées au client',
      trend: undefined,
      tone: summary.clientValidationsPending > 0 ? 'warning' : 'default',
    },
  };

  if (summary.finance) {
    const f = summary.finance;
    const c = f.currency;
    liveOverrides.rev = {
      value: formatAgencyMoneyCompact(f.expectedMonthlyRevenue, c),
      subtitle: 'Contrats clients actifs (prévisionnel)',
      trend: undefined,
      tone: f.expectedMonthlyRevenue > 0 ? 'positive' : 'default',
    };
    liveOverrides.collected = {
      value: formatAgencyMoneyCompact(f.collectedFromPayments, c),
      subtitle: 'Paiements enregistrés sur le mois',
      trend: undefined,
      tone: f.collectedFromPayments > 0 ? 'positive' : 'default',
    };
    liveOverrides.pending = {
      value: formatAgencyMoneyCompact(f.outstandingAmount, c),
      subtitle: 'Reste à encaisser (factures non soldées)',
      trend: undefined,
      tone: f.outstandingAmount > 0 ? 'warning' : 'default',
    };
    liveOverrides.unpaid = {
      value: String(f.unpaidCount),
      subtitle: `${f.overdueCount} en retard`,
      trend: undefined,
      tone: f.unpaidCount > 0 ? 'negative' : 'default',
    };
  }

  const showFinanceTargets =
    (summary.scope === 'full' && canViewGlobalFinanceStats(ctx.role)) ||
    summary.scope === 'finance' ||
    (summary.scope === 'commercial' && summary.finance != null);

  if (showFinanceTargets) {
    const g = summary.agencyMonthlyGoal;
    const fin = summary.finance;
    const c = fin?.currency ?? summary.agencyDisplayCurrency;
    const collected = fin?.collectedFromPayments ?? 0;
    if (!g) {
      liveOverrides.target = {
        title: 'Objectif mensuel (CA)',
        value: 'Non défini',
        subtitle:
          ctx.role === 'admin'
            ? 'Aucune ligne pour ce mois dans les paramètres agence.'
            : 'Non configuré pour le mois en cours.',
        subtitleLink: ctx.role === 'admin' ? { href: '/settings#objectifs-mensuels', label: 'Définir l’objectif' } : undefined,
        trend: undefined,
        tone: 'warning',
      };
    } else if (g.revenue_goal <= 0) {
      liveOverrides.target = {
        title: 'Objectif mensuel (CA)',
        value: 'À configurer',
        subtitle: 'Objectif CA à 0 — mettez à jour la fiche mensuelle.',
        subtitleLink: ctx.role === 'admin' ? { href: '/settings#objectifs-mensuels', label: 'Paramètres' } : undefined,
        trend: undefined,
        tone: 'warning',
      };
    } else {
      const pct = Math.round((collected / g.revenue_goal) * 100);
      const clamped = Math.min(100, Math.max(0, pct));
      liveOverrides.target = {
        title: 'Objectif mensuel (CA)',
        value: formatAgencyMoneyCompact(g.revenue_goal, c),
        subtitle: `${clamped} % de l’objectif (encaissé / objectif)`,
        trend: undefined,
        tone: clamped >= 100 ? 'positive' : 'default',
      };
    }
  }

  let mergedStats: StatCardData[];

  if (summary.scope === 'individual') {
    mergedStats = individualStatCards(ctx.employee.role, summary.personal);
  } else if (summary.scope === 'finance') {
    mergedStats = baseStatCards.filter((s) => FINANCE_STAT_IDS.has(s.id)).map((s) => ({
      ...s,
      ...(liveOverrides[s.id] ?? {}),
    }));
  } else if (summary.scope === 'operations') {
    const ops = baseStatCards
      .filter((s) => !FINANCE_STAT_IDS.has(s.id))
      .map((s) => ({
        ...s,
        ...(liveOverrides[s.id] ?? {}),
      }));
    mergedStats = [
      ...ops,
      {
        id: 'pm-my-due-today',
        title: 'Mes échéances aujourd’hui',
        value: String(summary.personal.myTasksDueToday),
        subtitle: 'tâches assignées à vous',
        tone: summary.personal.myTasksDueToday > 0 ? ('warning' as const) : ('default' as const),
      },
    ];
  } else if (summary.scope === 'commercial' && summary.commercial) {
    const baseCommercial = baseStatCards.filter((s) => s.id === 'clients').map((s) => ({
      ...s,
      ...(liveOverrides[s.id] ?? {}),
    }));
    mergedStats = [...baseCommercial, ...commercialExtraCards(summary.commercial)];
    if (summary.finance) {
      mergedStats = [
        ...mergedStats,
        ...baseStatCards.filter((s) => FINANCE_STAT_IDS.has(s.id)).map((s) => ({
          ...s,
          ...(liveOverrides[s.id] ?? {}),
        })),
      ];
    }
  } else {
    mergedStats = baseStatCards.map((s) => ({
      ...s,
      ...(liveOverrides[s.id] ?? {}),
    }));
  }

  const showFullProduction =
    (summary.scope === 'full' || summary.scope === 'operations') &&
    (variant === 'admin' || variant === 'manager');
  const showUrgentToday =
    (summary.scope === 'full' || summary.scope === 'operations') &&
    (variant === 'admin' || variant === 'manager');
  const showTeamBlocks = summary.scope === 'full' || summary.scope === 'operations';
  const showFinanceBlock =
    (summary.scope === 'full' && canViewGlobalFinanceStats(ctx.role)) ||
    summary.scope === 'finance' ||
    (summary.scope === 'commercial' && summary.finance != null);
  const showClientBlock = summary.scope === 'full' || summary.scope === 'operations' || summary.scope === 'commercial';
  const showProjectBlock = summary.scope === 'full' || summary.scope === 'operations';
  const showPersonalWorkColumn = Boolean(
    variant === 'individual' && ctx.employee && personalWork
  );
  const activitySectionTitle =
    variant === 'admin' ? 'Activité récente' : 'Fil d’activité métier';
  const activitySectionDescription =
    variant === 'admin'
      ? 'Audit interne — toutes zones (libellés lisibles).'
      : 'Dernières actions opérationnelles (excl. RH / Auth).';

  return (
    <div className="space-y-8">
      {summary.scope === 'full' && variant === 'admin' ? (
        <SectionCard title="Mon activité" description="Vos tâches et charges personnelles (données live).">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {individualStatCards(ctx.employee.role, summary.personal).slice(0, 4).map((s) => (
              <StatCard key={s.id} data={s} icon={STAT_ICONS[s.id] ?? ListTodo} />
            ))}
          </div>
        </SectionCard>
      ) : null}
      {(summary.scope === 'full' || summary.scope === 'operations') && variant === 'manager' ? (
        <SectionCard
          title="Charge personnelle"
          description="Vos tâches assignées uniquement — les indicateurs « équipe » et la bannière couvrent l’ensemble de l’agence."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {individualStatCards(ctx.employee.role, summary.personal).slice(0, 4).map((s) => (
              <StatCard key={s.id} data={s} icon={STAT_ICONS[s.id] ?? ListTodo} />
            ))}
          </div>
        </SectionCard>
      ) : null}

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Indicateurs clés
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {mergedStats.map((s) => (
            <StatCard key={s.id} data={s} icon={STAT_ICONS[s.id] ?? Wallet} />
          ))}
        </div>
      </section>

      <DashboardChartsDeferred
        variant={variant}
        scope={summary.scope}
        role={ctx.employee.role}
        currency={summary.agencyDisplayCurrency}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {showUrgentToday ? (
            <SectionCard
              title="Urgent aujourd’hui"
              description={
                summary.scope === 'operations'
                  ? 'Tâches urgentes, validations vidéo, rapports non envoyés et échéances production — sans indicateurs financiers globaux.'
                  : 'Factures échues, tâches urgentes, validations vidéo et rapports non envoyés.'
              }
              action={
                <Link href="/notifications" className="text-xs font-semibold text-primary hover:underline">
                  Voir tout
                </Link>
              }
            >
              <UrgentToday items={operational.urgentItems} />
            </SectionCard>
          ) : null}
          {showPersonalWorkColumn && personalWork ? (
            <PersonalWorkOverview
              role={ctx.employee!.role}
              tasks={personalWork.tasks}
              videos={personalWork.videos}
            />
          ) : null}
          {showFullProduction ? (
            <ProductionOverview
              videoStatusCounts={operational.videoStatusCounts}
              videos={operational.productionVideos}
            />
          ) : null}
          {showTeamBlocks ? (
            <TeamTasksSection today={operational.teamTasksToday} overdue={operational.teamTasksOverdue} />
          ) : null}
          {showFinanceBlock ? <FinanceOverview snapshot={financeSnapshot} /> : null}
          {summary.scope === 'operations' ? (
            <SectionCard
              title="Suivi production"
              description="Vue opérationnelle — pas de CA, encaissements, objectifs financiers ni agrégats de paiements globaux (réservés Admin / Finance)."
            >
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Projets en cours</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-foreground">{summary.projectsInProgress}</dd>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Tâches ouvertes (agence)</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-foreground">{summary.openTasks}</dd>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Validations client</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-foreground">{summary.clientValidationsPending}</dd>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Vidéos en pipeline</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-foreground">{summary.activeVideos}</dd>
                </div>
              </dl>
            </SectionCard>
          ) : null}
          {summary.scope === 'finance' &&
          summary.finance &&
          summary.finance.paidCount === 0 &&
          summary.finance.pendingCount === 0 &&
          summary.finance.unpaidCount === 0 ? (
            <SectionCard title="Rappels" description="Aucune facture en base pour l’instant.">
              <p className="text-sm text-muted-foreground">
                Les indicateurs restent à zéro sans erreur. Ajoutez des factures ou des paiements depuis le module
                Finance lorsque l’activité redémarre.
              </p>
            </SectionCard>
          ) : null}
          {summary.scope === 'commercial' && summary.commercial && summary.activeClients === 0 ? (
            <SectionCard title="Portefeuille" description="Aucun client actif ne vous est encore rattaché.">
              <p className="text-sm text-muted-foreground">
                Aucun client assigné pour le moment — demandez à un administrateur de vous attribuer des comptes ou
                créez un prospect si vous en avez le droit.
              </p>
            </SectionCard>
          ) : null}
        </div>
        <div className="space-y-6">
          {showTeamBlocks ? <TeamLoadSection members={operational.teamWorkload} /> : null}
          {showClientBlock ? <ClientOverview clients={operational.clientsFollow} /> : null}
          {showProjectBlock ? <ProjectOverview projects={operational.projectsOngoing} /> : null}
          <NotificationsPreview items={dashboardNotifications} />
          {(summary.scope === 'full' || summary.scope === 'operations') &&
          (variant === 'admin' || variant === 'manager') ? (
            <SectionCard title={activitySectionTitle} description={activitySectionDescription}>
              {dashboardActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune activité récente.</p>
              ) : (
                <RecentActivityPreview logs={dashboardActivity} variant={variant} />
              )}
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
