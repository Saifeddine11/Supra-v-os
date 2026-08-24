import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { formatAgencyMoneyCompact, type AgencyCurrencyIso } from '@/lib/money/format-money';
import { ProgressBar } from '@/components/shared/progress-bar';
import { UserAvatar } from '@/components/shared/user-avatar';
import { CountUpValue } from './count-up-value';
import { PeriodSelector } from './period-selector';
import {
  CockpitEmpty,
  CockpitSection,
  DeltaBadge,
  HealthLabel,
  PriorityPill,
  ProjectHealthLabel,
  QuietLink,
  WorkloadPill,
} from './cockpit-primitives';
import {
  InvoiceStatusDonut,
  ProjectTimeline,
  RevenueAreaChart,
  RevenueByClientBars,
  TaskStatusDonut,
  TeamHeatmap,
  TeamWorkloadStackedChart,
} from './cockpit-charts';
import type { AdminCockpitPayload } from '@/types/dashboard-cockpit';
import { cn } from '@/lib/utils/cn';

function Money({ amount, currency, className }: { amount: number; currency: AgencyCurrencyIso; className?: string }) {
  return <span className={cn('tabular-nums', className)}>{formatAgencyMoneyCompact(amount, currency)}</span>;
}

export function AdminCockpit({ data }: { data: AdminCockpitPayload }) {
  const { overview, health, finance, greeting } = data;
  const c = data.currency;

  return (
    <div className="space-y-10 pb-8 lg:space-y-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{greeting.dateLabel}</p>
          <h1 className="font-sans text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Bonjour {greeting.firstName}
          </h1>
          <p className="text-sm text-muted-foreground">{greeting.roleLabel} · cockpit agence</p>
        </div>
        <Suspense fallback={<div className="h-10 w-[min(100%,22rem)] animate-pulse rounded-full bg-muted/40" />}>
          <PeriodSelector value={data.periodKey} />
        </Suspense>
      </header>

      <section className="content-enter grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.7fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{overview.expectedLabel}</p>
              <p className="mt-1 font-sans text-4xl font-semibold tracking-tight text-foreground sm:text-[2.75rem]">
                <Money amount={overview.expectedRevenue} currency={c} />
              </p>
              {overview.expectedDelta ? (
                <div className="mt-1.5">
                  <DeltaBadge percent={overview.expectedDelta.percent} label={overview.expectedDelta.previousLabel} />
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
            <OverviewStat
              label="Encaissé"
              value={<Money amount={overview.collected} currency={c} />}
              hint={
                overview.collectedDelta ? (
                  <DeltaBadge percent={overview.collectedDelta.percent} label={overview.collectedDelta.previousLabel} />
                ) : (
                  data.periodLabel
                )
              }
            />
            <OverviewStat
              label="Reste à encaisser"
              value={<Money amount={overview.remaining} currency={c} />}
              hint={overview.unpaidInvoices > 0 ? `${overview.unpaidInvoices} facture(s) ouvertes` : 'Portefeuille soldé'}
              warn={overview.remaining > 0}
            />
            <OverviewStat
              label="Factures impayées"
              value={<CountUpValue value={overview.unpaidInvoices} className="tabular-nums" />}
              hint={overview.overdueInvoices > 0 ? `${overview.overdueInvoices} en retard` : 'Aucune échue'}
              warn={overview.overdueInvoices > 0}
            />
            <OverviewStat
              label="Tâches critiques"
              value={<CountUpValue value={overview.criticalTasks} className="tabular-nums" />}
              hint={overview.overdueTasks > 0 ? `${overview.overdueTasks} en retard` : 'Rien en retard'}
              warn={overview.criticalTasks > 0 || overview.overdueTasks > 0}
            />
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            {overview.activeProjects} projet{overview.activeProjects > 1 ? 's' : ''} actif{overview.activeProjects > 1 ? 's' : ''}
            {' · '}
            {overview.overloadedMembers === 0
              ? 'aucune surcharge équipe'
              : `${overview.overloadedMembers} personne${overview.overloadedMembers > 1 ? 's' : ''} en surcharge`}
            {' · '}
            {overview.upcomingDeliveries} livraison{overview.upcomingDeliveries > 1 ? 's' : ''} sur 7 j.
          </p>
        </div>

        <aside className="rounded-3xl bg-muted/20 px-5 py-5 sm:px-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Santé agence</p>
          <p className="mt-2 font-sans text-4xl font-semibold tabular-nums tracking-tight">
            <CountUpValue value={health.score} />
            <span className="text-lg font-medium text-muted-foreground"> / 100</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Moyenne de 4 dimensions (Bon 100 · Attention 62 · Critique 28)</p>
          <dl className="mt-5 space-y-3 text-sm">
            <HealthRow label="Finance" level={health.finance} note={health.notes.finance} />
            <HealthRow label="Exécution" level={health.execution} note={health.notes.execution} />
            <HealthRow label="Équipe" level={health.team} note={health.notes.team} />
            <HealthRow label="Livraison" level={health.delivery} note={health.notes.delivery} />
          </dl>
        </aside>
      </section>

      <CockpitSection
        title="Priorités"
        description="Ce qui demande une décision aujourd’hui."
        action={<QuietLink href="/notifications">Centre d’alertes</QuietLink>}
      >
        {data.actions.length === 0 ? (
          <CockpitEmpty
            title="Rien n’exige votre attention"
            description="Pas de tâche urgente en retard, facture échue ou projet bloqué sur les données actuelles."
          />
        ) : (
          <ul className="divide-y divide-border/40">
            {data.actions.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex flex-col gap-1 py-3.5 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityPill tone={item.tone} />
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.kind}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.explanation}</p>
                  </div>
                  {item.deadlineLabel ? (
                    <p className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.deadlineLabel}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CockpitSection>

      <CockpitSection
        title="Performance financière"
        description="Contrats, encaissements et factures — définitions identiques au reste de l’OS."
        action={<QuietLink href="/invoices">Factures</QuietLink>}
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
          <div className="min-w-0">
            <RevenueAreaChart
              data={finance.chart}
              currency={c}
              periodNote={
                data.periodKey === 'today'
                  ? 'Encaissements cumulés des 7 derniers jours — les totaux ci-dessus sont filtrés sur aujourd’hui.'
                  : `Encaissements cumulés · ${data.periodLabel}`
              }
            />
          </div>
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <FinCell label={finance.expectedLabel} value={<Money amount={finance.expectedRevenue} currency={c} />} />
              <FinCell label="Encaissé" value={<Money amount={finance.collected} currency={c} />} />
              <FinCell label="En attente" value={<Money amount={finance.pending} currency={c} />} />
              <FinCell label="En retard" value={<Money amount={finance.overdueAmount} currency={c} />} warn={finance.overdueAmount > 0} />
            </dl>
            {finance.goal != null && finance.goal > 0 ? (
              <p className="text-xs text-muted-foreground">
                Objectif du mois : <Money amount={finance.goal} currency={c} className="font-medium text-foreground" />
              </p>
            ) : null}
            <InvoiceStatusDonut status={finance.invoiceStatus} />
          </div>
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-medium">Encaissé par client</h3>
            <RevenueByClientBars rows={finance.revenueByClient} currency={c} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-medium">Échéances de paiement</h3>
            {finance.upcomingPayments.length === 0 ? (
              <CockpitEmpty title="Aucune échéance à venir" description="Pas de facture ouverte avec une date d’échéance future." />
            ) : (
              <ul className="divide-y divide-border/40">
                {finance.upcomingPayments.map((p) => (
                  <li key={p.id}>
                    <Link href={p.href} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary">
                      <span className="min-w-0 truncate">{p.title}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {p.dueLabel} · {formatAgencyMoneyCompact(p.amount, c)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CockpitSection>

      <CockpitSection
        title="Équipe — qui fait quoi"
        description="Charge dérivée des tâches ouvertes, retards et heures estimées / capacité hebdomadaire."
        action={<QuietLink href="/team">Fiches équipe</QuietLink>}
      >
        {data.team.length === 0 ? (
          <CockpitEmpty title="Aucun collaborateur actif" description="Ajoutez des membres pour suivre la charge." href="/team" hrefLabel="Ouvrir l’équipe" />
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {data.team.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/team/${m.id}`}
                    className="flex flex-col gap-2 rounded-2xl bg-muted/15 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={m.name} initials={m.initials} color={m.color} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{m.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{m.roleLabel}</span>
                      </span>
                      <WorkloadPill state={m.workload} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {m.assignedTasks} tâche{m.assignedTasks > 1 ? 's' : ''}
                      {m.overdueTasks > 0 ? ` · ${m.overdueTasks} en retard` : ''}
                      {m.urgentTasks > 0 ? ` · ${m.urgentTasks} urgent` : ''}
                      {' · '}
                      {m.nextDeadlineLabel ?? 'pas d’échéance'}
                    </p>
                    <ProgressBar value={m.hoursLoadPercent} className="h-1.5" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="-mx-1 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-3 font-medium">Personne</th>
                    <th className="pb-3 pr-3 font-medium">Tâches</th>
                    <th className="pb-3 pr-3 font-medium">Retard</th>
                    <th className="pb-3 pr-3 font-medium">Urgent</th>
                    <th className="pb-3 pr-3 font-medium">Projets</th>
                    <th className="pb-3 pr-3 font-medium">Prochaine échéance</th>
                    <th className="pb-3 font-medium">Charge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {data.team.map((m) => (
                    <tr key={m.id} className="align-middle">
                      <td className="py-3 pr-3">
                        <Link href={`/team/${m.id}`} className="flex min-w-0 items-center gap-2.5 hover:text-primary">
                          <UserAvatar name={m.name} initials={m.initials} color={m.color} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{m.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{m.roleLabel}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 pr-3 tabular-nums">{m.assignedTasks}</td>
                      <td className={cn('py-3 pr-3 tabular-nums', m.overdueTasks > 0 && 'text-destructive')}>{m.overdueTasks}</td>
                      <td className="py-3 pr-3 tabular-nums">{m.urgentTasks}</td>
                      <td className="py-3 pr-3 tabular-nums">{m.activeProjects}</td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">{m.nextDeadlineLabel ?? '—'}</td>
                      <td className="py-3">
                        <div className="flex min-w-[140px] items-center gap-2">
                          <ProgressBar value={m.hoursLoadPercent} className="h-1.5 w-16" />
                          <WorkloadPill state={m.workload} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CockpitSection>

      <div className="grid gap-10 lg:grid-cols-2">
        <CockpitSection title="Charge par personne" description="À faire, en cours, en retard, terminées sur la période.">
          <TeamWorkloadStackedChart members={data.team} />
        </CockpitSection>
        <CockpitSection title="Semaine en cours" description="Intensité = échéances tâches, tournages et livraisons du jour.">
          <TeamHeatmap days={data.heatmap.days} rows={data.heatmap.rows} hasSignal={data.heatmap.hasSignal} />
        </CockpitSection>
      </div>

      <CockpitSection
        title="Projets"
        description="Statut calculé : bloqué (tâche bloquée / attente contenu), en retard (échéance dépassée), attention (attente client, retards, J-7)."
        action={<QuietLink href="/projects">Tous les projets</QuietLink>}
      >
        {data.projects.length === 0 ? (
          <CockpitEmpty
            title="Aucun projet actif"
            description="Créez ou activez un projet pour suivre l’exécution."
            href="/projects"
            hrefLabel="Ouvrir les projets"
          />
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {data.projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={p.href}
                    className="flex flex-col gap-2 rounded-2xl bg-muted/15 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{p.client ?? '—'}</span>
                      </span>
                      <ProjectHealthLabel health={p.health} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.phaseLabel}
                      {' · '}
                      {p.deadlineLabel ?? 'sans date'}
                      {p.overdueTasks > 0 ? ` · ${p.overdueTasks} retard` : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={p.progress} className="h-1.5 flex-1" indicatorClassName="bg-primary" />
                      <span className="tabular-nums text-xs text-muted-foreground">{p.progress}%</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="-mx-1 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-3 font-medium">Projet</th>
                    <th className="pb-3 pr-3 font-medium">Resp.</th>
                    <th className="pb-3 pr-3 font-medium">Phase</th>
                    <th className="pb-3 pr-3 font-medium">Avancement</th>
                    <th className="pb-3 pr-3 font-medium">Tâches</th>
                    <th className="pb-3 pr-3 font-medium">Échéance</th>
                    <th className="pb-3 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {data.projects.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 pr-3">
                        <Link href={p.href} className="block min-w-0 hover:text-primary">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{p.client ?? '—'}</span>
                        </Link>
                      </td>
                      <td className="max-w-[120px] truncate py-3 pr-3 text-xs text-muted-foreground">{p.leadName ?? '—'}</td>
                      <td className="py-3 pr-3 text-xs">{p.phaseLabel}</td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={p.progress} className="h-1.5 w-20" indicatorClassName="bg-primary" />
                          <span className="tabular-nums text-xs text-muted-foreground">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-xs tabular-nums text-muted-foreground">
                        {p.tasksTotal > 0 ? `${p.tasksDone}/${p.tasksTotal}` : '—'}
                        {p.overdueTasks > 0 ? <span className="ml-1 text-destructive">{p.overdueTasks} retard</span> : null}
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">{p.deadlineLabel ?? 'Sans date'}</td>
                      <td className="py-3">
                        <ProjectHealthLabel health={p.health} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-medium">Frise — 4 semaines</h3>
          <ProjectTimeline projects={data.projects} />
        </div>
      </CockpitSection>

      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <CockpitSection title="Tâches" description="Ouvertes vs clôturées sur la période sélectionnée.">
          <TaskStatusDonut tasks={data.tasks} />
        </CockpitSection>
        <CockpitSection title="Échéances" description="Aujourd’hui, demain, cette semaine." action={<QuietLink href="/tasks/calendar">Calendrier</QuietLink>}>
          {data.deadlines.length === 0 ? (
            <CockpitEmpty title="Rien de daté cette semaine" description="Les tâches, projets, tournages, livraisons et factures avec une date apparaîtront ici." />
          ) : (
            <DeadlineList items={data.deadlines} />
          )}
        </CockpitSection>
      </div>

      <CockpitSection title="Activité récente" description="Journal métier existant — pas de nouvel événement inventé.">
        {data.activity.length === 0 ? (
          <CockpitEmpty title="Aucune activité récente" description="Les créations et mises à jour (tâches, factures, projets…) s’afficheront ici." />
        ) : (
          <ul className="divide-y divide-border/40">
            {data.activity.map((a) => {
              const inner = (
                <>
                  <p className="text-sm text-foreground">{a.summary}</p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{a.atLabel}</p>
                </>
              );
              return (
                <li key={a.id} className="py-3">
                  {a.href ? (
                    <Link href={a.href} className="block hover:text-primary">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CockpitSection>
    </div>
  );
}

function OverviewStat({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  warn?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tracking-tight sm:text-2xl', warn && 'text-destructive')}>{value}</p>
      {hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function HealthRow({
  label,
  level,
  note,
}: {
  label: string;
  level: AdminCockpitPayload['health']['finance'];
  note: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">
        <HealthLabel level={level} />
        <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>
      </dd>
    </div>
  );
}

function FinCell({ label, value, warn }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 font-semibold', warn && 'text-destructive')}>{value}</dd>
    </div>
  );
}

function DeadlineList({ items }: { items: AdminCockpitPayload['deadlines'] }) {
  const groups: { key: AdminCockpitPayload['deadlines'][number]['bucket']; label: string }[] = [
    { key: 'today', label: 'Aujourd’hui' },
    { key: 'tomorrow', label: 'Demain' },
    { key: 'week', label: 'Cette semaine' },
  ];
  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const rows = items.filter((i) => i.bucket === g.key);
        if (rows.length === 0) return null;
        return (
          <div key={g.key}>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g.label}</p>
            <ul className="space-y-2">
              {rows.map((i) => (
                <li key={i.id}>
                  <Link href={i.href} className="flex items-baseline justify-between gap-3 text-sm hover:text-primary">
                    <span className="min-w-0 truncate font-medium">{i.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{i.meta}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
