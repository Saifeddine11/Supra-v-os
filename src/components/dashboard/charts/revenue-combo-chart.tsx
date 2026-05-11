'use client';

import { useId, useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAgencyMoneyCompact, type AgencyCurrencyIso } from '@/lib/money/format-money';
import type { RevenueMonthPoint } from '@/types/dashboard-charts';
import { ChartCard, ChartCardEmpty } from './chart-card';
import { ChartLegendPills } from './custom-chart-legend';
import { DashboardChartTooltip, type ChartTooltipRow } from './custom-chart-tooltip';
import { Wallet } from 'lucide-react';

const SLATE = 'var(--chart-slate)';
const ORANGE = 'var(--chart-orange)';
const AMBER = 'var(--chart-amber)';
const VIOLET = 'var(--chart-violet)';

export function RevenueComboChart({ data, currency }: { data: RevenueMonthPoint[]; currency: AgencyCurrencyIso }) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  type ChartRow = {
    label: string;
    prevu: number;
    encaisse: number;
    attente: number;
    objectif: number | null;
    hasGoal: boolean;
  };

  const chartData: ChartRow[] = useMemo(
    () =>
      data.map((d) => {
        const hasGoal = d.revenueGoal != null && d.revenueGoal > 0;
        return {
          label: d.label,
          prevu: d.expectedRevenue,
          encaisse: d.collected,
          attente: d.pendingOpen,
          objectif: hasGoal ? Number(d.revenueGoal) : null,
          hasGoal,
        };
      }),
    [data],
  );

  const empty =
    chartData.length === 0 ||
    chartData.every((d) => d.prevu === 0 && d.encaisse === 0 && d.attente === 0 && !d.hasGoal);

  const badge = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }, []);

  const legendItems = useMemo(
    () => [
      { key: 'prevu', label: 'CA prévu', color: SLATE },
      { key: 'enc', label: 'Encaissé', color: ORANGE },
      { key: 'att', label: 'En attente (mois en cours)', color: AMBER },
      { key: 'obj', label: 'Objectif', color: VIOLET },
    ],
    [],
  );

  return (
    <ChartCard
      title="CA & objectif"
      subtitle="Prévisionnel contrats, encaissements, créances ouvertes sur le mois en cours, objectif mensuel."
      badge={badge}
      bodyClassName="space-y-0"
    >
      {empty ? (
        <ChartCardEmpty
          icon={Wallet}
          title="Aucune donnée financière sur cette période"
          description="Les barres apparaîtront dès que des contrats, paiements ou objectifs seront renseignés pour ces mois."
        />
      ) : (
        <>
          <div className="h-[min(340px,52vh)] w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} barGap={6} barCategoryGap="18%" margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id={`${gid}-prevu`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#64748b" stopOpacity={0.28} />
                  </linearGradient>
                  <linearGradient id={`${gid}-enc`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6a2a" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#ff3d0a" stopOpacity={0.45} />
                  </linearGradient>
                  <linearGradient id={`${gid}-att`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" strokeOpacity={1} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                  tickLine={false}
                  axisLine={false}
                  dy={6}
                />
                <YAxis
                  width={52}
                  tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatAgencyMoneyCompact(Number(v), currency)}
                />
                <Tooltip
                  cursor={{ fill: 'var(--chart-orange-soft)', opacity: 0.35 }}
                  content={({ active, label, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0]?.payload as ChartRow;
                    const rows: ChartTooltipRow[] = [
                      { key: 'p', label: 'CA prévu', value: formatAgencyMoneyCompact(p.prevu, currency), color: SLATE },
                      { key: 'e', label: 'Encaissé', value: formatAgencyMoneyCompact(p.encaisse, currency), color: ORANGE },
                      { key: 'a', label: 'En attente', value: formatAgencyMoneyCompact(p.attente, currency), color: AMBER },
                    ];
                    if (p.hasGoal && p.objectif != null) {
                      rows.push({
                        key: 'o',
                        label: 'Objectif',
                        value: formatAgencyMoneyCompact(p.objectif, currency),
                        color: VIOLET,
                      });
                    }
                    return <DashboardChartTooltip active={active} title={String(label)} rows={rows} />;
                  }}
                />
                <Bar dataKey="prevu" fill={`url(#${gid}-prevu)`} radius={[8, 8, 0, 0]} maxBarSize={28} opacity={0.92} />
                <Bar dataKey="encaisse" fill={`url(#${gid}-enc)`} radius={[8, 8, 0, 0]} maxBarSize={28} opacity={0.95} />
                <Bar dataKey="attente" fill={`url(#${gid}-att)`} radius={[8, 8, 0, 0]} maxBarSize={28} opacity={0.88} />
                <Line
                  type="monotone"
                  dataKey="objectif"
                  stroke={VIOLET}
                  strokeWidth={2}
                  strokeOpacity={0.88}
                  dot={{ r: 3, fill: VIOLET, strokeWidth: 0, fillOpacity: 0.9 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <ChartLegendPills items={legendItems} />
        </>
      )}
    </ChartCard>
  );
}
