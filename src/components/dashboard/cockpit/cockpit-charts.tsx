'use client';

import { useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAgencyMoneyCompact, type AgencyCurrencyIso } from '@/lib/money/format-money';
import { ChartLegendPills } from '@/components/dashboard/charts/custom-chart-legend';
import { DashboardChartTooltip, type ChartTooltipRow } from '@/components/dashboard/charts/custom-chart-tooltip';
import { CockpitEmpty } from './cockpit-primitives';
import type {
  CockpitClientRevenue,
  CockpitHeatmapRow,
  CockpitInvoiceStatus,
  CockpitProjectRow,
  CockpitRevenuePoint,
  CockpitTaskStatus,
  CockpitTeamMember,
} from '@/types/dashboard-cockpit';
import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

const ORANGE = 'var(--chart-orange)';
const SLATE = 'var(--chart-slate)';
const EMERALD = 'var(--chart-emerald)';
const AMBER = 'var(--chart-amber)';
const ROSE = 'var(--chart-rose)';

const ANIM = { animationDuration: 650, animationEasing: 'ease-out' as const };

export function RevenueAreaChart({
  data,
  currency,
  periodNote,
}: {
  data: CockpitRevenuePoint[];
  currency: AgencyCurrencyIso;
  periodNote: string;
}) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const hasExpected = data.some((d) => d.expected != null && d.expected > 0);
  const empty = data.every(
    (d) => d.collected === 0 && (d.expected == null || d.expected === 0) && (d.remaining == null || d.remaining === 0),
  );

  if (empty) {
    return (
      <CockpitEmpty
        title="Pas encore d’encaissements sur cette période"
        description="Le graphique apparaîtra dès qu’un paiement sera enregistré."
        href="/payments"
        hrefLabel="Ouvrir les paiements"
      />
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">{periodNote}</p>
      <div className="h-[240px] w-full sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} {...ANIM}>
            <defs>
              <linearGradient id={`${gid}-c`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff3d0a" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#ff3d0a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} tickLine={false} axisLine={false} />
            <YAxis
              width={48}
              tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatAgencyMoneyCompact(Number(v), currency)}
            />
            <Tooltip
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]?.payload as CockpitRevenuePoint;
                const rows: ChartTooltipRow[] = [
                  { key: 'c', label: 'Encaissé cumulé', value: formatAgencyMoneyCompact(p.collected, currency), color: ORANGE },
                ];
                if (p.expected != null) {
                  rows.push({
                    key: 'e',
                    label: 'CA prévu (mois)',
                    value: formatAgencyMoneyCompact(p.expected, currency),
                    color: SLATE,
                  });
                }
                if (p.remaining != null) {
                  rows.push({
                    key: 'r',
                    label: 'Reste à encaisser',
                    value: formatAgencyMoneyCompact(p.remaining, currency),
                    color: AMBER,
                  });
                }
                return <DashboardChartTooltip active={active} title={String(label)} rows={rows} />;
              }}
            />
            {hasExpected ? (
              <Area
                type="monotone"
                dataKey="expected"
                stroke={SLATE}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
                connectNulls
                name="Prévu"
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="collected"
              stroke={ORANGE}
              strokeWidth={2}
              fill={`url(#${gid}-c)`}
              name="Encaissé cumulé"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ChartLegendPills
        items={[
          { key: 'c', label: 'Encaissé cumulé', color: ORANGE },
          ...(hasExpected ? [{ key: 'e', label: 'CA prévu', color: SLATE }] : []),
        ]}
      />
    </div>
  );
}

export function InvoiceStatusDonut({ status }: { status: CockpitInvoiceStatus }) {
  const total = status.paid + status.pending + status.overdue;
  const data = useMemo(
    () => [
      { key: 'paid', name: 'Payées', value: status.paid, color: EMERALD },
      { key: 'pending', name: 'En attente', value: status.pending, color: AMBER },
      { key: 'overdue', name: 'En retard', value: status.overdue, color: ROSE },
    ],
    [status],
  );

  if (total === 0) {
    return (
      <CockpitEmpty
        title="Aucune facture"
        description="Créez une facture pour suivre l’état du portefeuille."
        href="/invoices"
        hrefLabel="Ouvrir les factures"
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart {...ANIM}>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} stroke="none">
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0];
                return (
                  <DashboardChartTooltip
                    active={active}
                    title={String(p.name)}
                    rows={[{ key: 'v', label: 'Factures', value: String(p.value), color: String(p.payload.color) }]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {data.map((d) => (
          <li key={d.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
              {d.name}
            </span>
            <span className="tabular-nums font-medium text-foreground">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RevenueByClientBars({
  rows,
  currency,
}: {
  rows: CockpitClientRevenue[];
  currency: AgencyCurrencyIso;
}) {
  if (rows.length === 0) {
    return (
      <CockpitEmpty
        title="Pas de répartition client"
        description="Les encaissements de la période n’ont pas encore de rattachement client exploitable."
      />
    );
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }} {...ANIM}>
          <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
            tickFormatter={(v) => formatAgencyMoneyCompact(Number(v), currency)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={96}
            tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as CockpitClientRevenue;
              return (
                <DashboardChartTooltip
                  active={active}
                  title={p.name}
                  rows={[{ key: 'a', label: 'Encaissé', value: formatAgencyMoneyCompact(p.amount, currency), color: ORANGE }]}
                />
              );
            }}
          />
          <Bar dataKey="amount" fill={ORANGE} radius={[0, 6, 6, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TeamWorkloadStackedChart({ members }: { members: CockpitTeamMember[] }) {
  const data = members
    .filter((m) => m.openTasks + m.inProgressTasks + m.completedInPeriod > 0)
    .slice(0, 12)
    .map((m) => ({
      name: m.name.split(' ')[0] ?? m.name,
      full: m.name,
      open: m.openTasks,
      progress: m.inProgressTasks,
      overdue: m.overdueTasks,
      done: m.completedInPeriod,
    }));

  if (data.length === 0) {
    return (
      <CockpitEmpty
        title="Aucune charge tâche"
        description="Assignez des tâches à l’équipe pour visualiser la répartition."
        href="/tasks"
        hrefLabel="Ouvrir les tâches"
      />
    );
  }

  return (
    <div className="h-[min(360px,52vh)] w-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }} {...ANIM}>
          <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof data)[number];
              return (
                <DashboardChartTooltip
                  active={active}
                  title={p.full}
                  rows={[
                    { key: 'o', label: 'À faire', value: String(p.open), color: SLATE },
                    { key: 'p', label: 'En cours', value: String(p.progress), color: ORANGE },
                    { key: 'd', label: 'Terminées (période)', value: String(p.done), color: EMERALD },
                    { key: 'l', label: 'Dont en retard', value: String(p.overdue), color: ROSE },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="open" stackId="a" fill={SLATE} maxBarSize={14} />
          <Bar dataKey="progress" stackId="a" fill={ORANGE} maxBarSize={14} />
          <Bar dataKey="done" stackId="a" fill={EMERALD} radius={[0, 6, 6, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
      <ChartLegendPills
        items={[
          { key: 'o', label: 'À faire', color: SLATE },
          { key: 'p', label: 'En cours', color: ORANGE },
          { key: 'd', label: 'Terminées', color: EMERALD },
        ]}
      />
    </div>
  );
}

export function TaskStatusDonut({ tasks }: { tasks: CockpitTaskStatus }) {
  const data = [
    { key: 'todo', name: 'À faire', value: tasks.todo, color: SLATE },
    { key: 'prog', name: 'En cours', value: tasks.inProgress, color: ORANGE },
    { key: 'done', name: 'Terminées', value: tasks.completed, color: EMERALD },
    { key: 'od', name: 'En retard', value: tasks.overdue, color: ROSE },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <CockpitEmpty
        title="Aucune tâche à analyser"
        description="Créez ou assignez des tâches pour suivre l’exécution."
        href="/tasks"
        hrefLabel="Ouvrir les tâches"
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-[168px] w-[168px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart {...ANIM}>
            <Pie data={data} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0];
                return (
                  <DashboardChartTooltip
                    active={active}
                    title={String(p.name)}
                    rows={[{ key: 'v', label: 'Tâches', value: String(p.value), color: String(p.payload.color) }]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full space-y-2">
        {data.map((d) => (
          <div key={d.key} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
              {d.name}
            </span>
            <span className="tabular-nums font-medium">{d.value}</span>
          </div>
        ))}
        {tasks.completionRate != null ? (
          <p className="pt-1 text-xs text-muted-foreground">
            Taux de clôture période : <span className="font-semibold tabular-nums text-foreground">{tasks.completionRate}%</span>
            <span className="block text-[11px]">terminées / (terminées + ouvertes hors attente client)</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function heatColor(count: number, max: number) {
  if (count <= 0 || max <= 0) return 'hsl(var(--muted) / 0.35)';
  const t = Math.min(1, count / max);
  const alpha = 0.18 + t * 0.72;
  return `color-mix(in srgb, var(--supra-orange) ${Math.round(alpha * 100)}%, transparent)`;
}

export function TeamHeatmap({
  days,
  rows,
  hasSignal,
}: {
  days: { key: string; label: string }[];
  rows: CockpitHeatmapRow[];
  hasSignal: boolean;
}) {
  if (!hasSignal) {
    return (
      <CockpitEmpty
        title="Pas assez d’échéances datées"
        description="Le heatmap s’affiche lorsque des tâches, tournages ou livraisons ont une date cette semaine."
      />
    );
  }
  const max = Math.max(1, ...rows.flatMap((r) => r.cells.map((c) => c.count)));

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-1 text-left">
        <thead>
          <tr>
            <th className="w-28 px-1 text-[11px] font-medium text-muted-foreground"> </th>
            {days.map((d) => (
              <th key={d.key} className="px-1 text-center text-[11px] font-medium capitalize text-muted-foreground">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employeeId}>
              <td className="truncate px-1 py-0.5 text-xs text-foreground">{r.name.split(' ')[0]}</td>
              {r.cells.map((c) => (
                <td key={c.dayKey} className="p-0">
                  <div
                    role="img"
                    className="mx-auto h-8 w-full min-w-[36px] rounded-md"
                    style={{ background: heatColor(c.count, max) }}
                    aria-label={`${r.name} · ${c.label} · ${c.count} échéance(s)`}
                    title={`${r.name} · ${c.label} · ${c.count} échéance(s)`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectTimeline({ projects }: { projects: CockpitProjectRow[] }) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const horizon = addDays(start, 28);
  const dated = projects.filter((p) => p.deadline || p.startDate);

  if (dated.length === 0) {
    return (
      <CockpitEmpty
        title="Pas de dates projet"
        description="Ajoutez une échéance aux projets actifs pour afficher la frise des 4 prochaines semaines."
        href="/projects"
        hrefLabel="Ouvrir les projets"
      />
    );
  }

  const span = differenceInCalendarDays(horizon, start) || 1;

  return (
    <div className="space-y-2.5">
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>Aujourd’hui</span>
        <span>{format(horizon, 'd MMM', { locale: fr })}</span>
      </div>
      {dated.slice(0, 10).map((p) => {
        const from = p.startDate ? new Date(`${p.startDate}T12:00:00`) : start;
        const to = p.deadline ? new Date(`${p.deadline}T12:00:00`) : horizon;
        const leftDays = Math.max(0, differenceInCalendarDays(from, start));
        const widthDays = Math.max(1, differenceInCalendarDays(to < start ? start : to, from < start ? start : from));
        const left = Math.min(100, (leftDays / span) * 100);
        const width = Math.min(100 - left, (widthDays / span) * 100);
        const late = p.health === 'late' || p.health === 'blocked';
        return (
          <div key={p.id} className="grid grid-cols-[minmax(0,140px)_1fr] items-center gap-3">
            <p className="truncate text-xs text-foreground">{p.name}</p>
            <div className="relative h-6 overflow-hidden rounded-full bg-muted/30">
              <div
                className="absolute top-1 h-4 rounded-full"
                style={{
                  left: `${left}%`,
                  width: `${Math.max(width, 2)}%`,
                  background: late ? 'hsl(var(--destructive) / 0.55)' : 'hsl(var(--primary) / 0.45)',
                }}
                title={`${p.name}${p.deadline ? ` · ${p.deadlineLabel}` : ''}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
