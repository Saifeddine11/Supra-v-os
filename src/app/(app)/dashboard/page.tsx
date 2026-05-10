import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
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
import { requireAuth } from '@/lib/auth/permissions';
import {
  canModifyClients,
  canModifyInvoices,
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
import {
  CLIENTS_FOLLOW,
  DASHBOARD_STATS,
  FINANCE_SNAPSHOT,
  PROJECTS_ONGOING,
  TASKS_OVERDUE,
  TASKS_TODAY,
  TEAM_WORKLOAD,
  URGENT_TODAY,
  VIDEOS_BY_FOCUS,
  type StatCardData,
} from '@/data/dashboard-mock';
import { financeSnapshotFromAgg, getDashboardSummary } from '@/lib/data/dashboard-stats';
import { listRecentNotifications } from '@/lib/data/notifications-user';
import { listRecentActivity } from '@/lib/data/activity-logs';
import { RecentActivityPreview } from '@/components/dashboard/recent-activity-preview';
import type { UserRole } from '@/types/database';

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
};

const FINANCE_STAT_IDS = new Set(['rev', 'target', 'collected', 'pending', 'unpaid']);

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] ?? full;
}

function roleLabel(role: UserRole | undefined) {
  return role?.replace(/_/g, ' ') ?? '—';
}

function introForScope(scope: string, role: UserRole | undefined): string {
  switch (scope) {
    case 'full':
      return 'Pilotage agence : KPI globaux, charge équipe et finance (selon accès). Les blocs détaillés maquette complètent la vue live.';
    case 'finance':
      return 'Concentré trésorerie et facturation : encaissements, impayés et devis. Les agrégats proviennent de Supabase.';
    case 'commercial':
      return 'Portefeuille clients qui vous sont attribués, pipeline de devis et suivi des relances. Chiffres devis filtrés sur vos comptes.';
    case 'individual':
      return 'Vue centrée sur vos tâches, livrables et échéances assignés — sans métriques globales agence.';
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
      subtitle: 'échéance dépassée',
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
    if (rk === 'cameraman' || rk === 'community_manager') {
      cards.push({
        id: 'my-videos-cam',
        title: 'Vidéos (tournage)',
        value: String(p.myVideosAsCameraman),
        subtitle: 'hors publié / archivé',
      });
    }
    if (rk === 'cameraman') {
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

export default async function DashboardPage() {
  const ctx = await requireAuth();
  if (!ctx.employee) {
    redirect('/login?next=/dashboard');
  }

  const todayLabel = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  let recentActivity: Awaited<ReturnType<typeof listRecentActivity>> = [];
  try {
    recentActivity = await listRecentActivity(10);
  } catch {
    recentActivity = [];
  }

  const [summary, dashboardNotifications] = await Promise.all([
    getDashboardSummary(ctx),
    listRecentNotifications(6, ctx),
  ]);
  const liveFinancePartial = financeSnapshotFromAgg(summary.finance, summary.agencyMonthlyGoal);

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
      title: summary.scope === 'commercial' ? 'Tâches en retard (vous)' : 'Tâches en retard',
      value: String(summary.overdueTasks),
      subtitle:
        summary.scope === 'commercial' || summary.scope === 'individual'
          ? 'vos échéances dépassées'
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
      value: `${f.monthlyRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} ${c}`,
      subtitle: 'factures payées — encaissements du mois',
      trend: undefined,
      tone: 'positive',
    };
    liveOverrides.pending = {
      value: `${f.pendingAmount.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} ${c}`,
      subtitle: `${f.pendingCount} facture(s) envoyée(s) ou en attente`,
      trend: undefined,
      tone: 'warning',
    };
    liveOverrides.unpaid = {
      value: String(f.unpaidCount),
      subtitle: `${f.overdueCount} en retard`,
      trend: undefined,
      tone: f.unpaidCount > 0 ? 'negative' : 'default',
    };
  }

  const showFinanceTargets =
    summary.scope === 'full' ||
    summary.scope === 'finance' ||
    (summary.scope === 'commercial' && summary.finance != null);

  if (showFinanceTargets) {
    const g = summary.agencyMonthlyGoal;
    const fin = summary.finance;
    const c = fin?.currency ?? 'MAD';
    const collected = fin?.monthlyRevenue ?? 0;
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
        value: `${g.revenue_goal.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} ${c}`,
        subtitle: `${clamped} % de l’objectif (CA encaissé ce mois)`,
        trend: undefined,
        tone: clamped >= 100 ? 'positive' : 'default',
      };
    }
  }

  let mergedStats: StatCardData[];

  if (summary.scope === 'individual') {
    mergedStats = individualStatCards(ctx.employee.role, summary.personal);
  } else if (summary.scope === 'finance') {
    mergedStats = DASHBOARD_STATS.filter((s) => FINANCE_STAT_IDS.has(s.id)).map((s) => ({
      ...s,
      ...(liveOverrides[s.id] ?? {}),
    }));
  } else if (summary.scope === 'commercial' && summary.commercial) {
    const baseCommercial = DASHBOARD_STATS.filter((s) => s.id === 'clients').map((s) => ({
      ...s,
      ...(liveOverrides[s.id] ?? {}),
    }));
    mergedStats = [...baseCommercial, ...commercialExtraCards(summary.commercial)];
    if (summary.finance) {
      mergedStats = [
        ...mergedStats,
        ...DASHBOARD_STATS.filter((s) => FINANCE_STAT_IDS.has(s.id)).map((s) => ({
          ...s,
          ...(liveOverrides[s.id] ?? {}),
        })),
      ];
    }
  } else {
    mergedStats = DASHBOARD_STATS.map((s) => ({
      ...s,
      ...(liveOverrides[s.id] ?? {}),
    }));
  }

  const showFullProduction = summary.scope === 'full';
  const showTeamBlocks = summary.scope === 'full';
  const showFinanceBlock = summary.scope === 'full' || summary.scope === 'finance' || summary.scope === 'commercial';
  const showClientBlock = summary.scope === 'full' || summary.scope === 'commercial';
  const showProjectBlock = summary.scope === 'full';

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{todayLabel}</p>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Bonjour {firstName(ctx.employee.full_name)},
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {introForScope(summary.scope, ctx.employee.role)}
          </p>
          <p className="text-sm text-muted-foreground">
            Rôle :{' '}
            <span className="font-medium capitalize text-primary">{roleLabel(ctx.employee.role)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(() => {
            type Quick = { href: string; label: string };
            const items: Quick[] = [];
            if (canModifyClients(ctx.role)) items.push({ href: '/clients', label: 'Nouveau client' });
            if (navItemVisible('/tasks', ctx.employee.role)) items.push({ href: '/tasks', label: 'Nouvelle tâche' });
            if (canModifyInvoices(ctx.role)) items.push({ href: '/invoices', label: 'Nouvelle facture' });
            return items.map((item, i) => (
              <ActionButton key={item.href} href={item.href} variant={i === 0 ? 'primary' : 'secondary'}>
                {item.label}
              </ActionButton>
            ));
          })()}
        </div>
      </header>

      {summary.scope === 'full' ? (
        <SectionCard title="Mon activité" description="Vos tâches et charges personnelles (données live).">
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

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {summary.scope === 'full' ? (
            <SectionCard
              title="Urgent aujourd’hui"
              description="Points nécessitant une action rapide de l’équipe."
              action={
                <Link href="/notifications" className="text-xs font-semibold text-primary hover:underline">
                  Voir tout
                </Link>
              }
            >
              <UrgentToday items={URGENT_TODAY} />
            </SectionCard>
          ) : null}
          {showFullProduction ? <ProductionOverview videos={VIDEOS_BY_FOCUS} /> : null}
          {showTeamBlocks ? <TeamTasksSection today={TASKS_TODAY} overdue={TASKS_OVERDUE} /> : null}
          {showFinanceBlock ? (
            <FinanceOverview snapshot={FINANCE_SNAPSHOT} liveFinance={liveFinancePartial} />
          ) : null}
        </div>
        <div className="space-y-6">
          {showTeamBlocks ? <TeamLoadSection members={TEAM_WORKLOAD} /> : null}
          {showClientBlock ? <ClientOverview clients={CLIENTS_FOLLOW} /> : null}
          {showProjectBlock ? <ProjectOverview projects={PROJECTS_ONGOING} /> : null}
          <NotificationsPreview items={dashboardNotifications} />
          {recentActivity.length > 0 ? (
            <SectionCard title="Activité récente" description="Journal serveur (aperçu).">
              <RecentActivityPreview logs={recentActivity} />
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
