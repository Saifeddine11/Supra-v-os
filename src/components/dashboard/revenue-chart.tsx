'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RevenueChartPoint } from '@/data/dashboard-mock';

export function RevenueChart({ data }: { data: RevenueChartPoint[] }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fillRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff450f" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#ff450f" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fillTgt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a8a19a" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#a8a19a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.35)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '10px',
              color: 'hsl(var(--card-foreground))',
              fontSize: '12px',
            }}
            formatter={(value: number, name: string) => [
              `${value.toLocaleString('fr-FR')} MAD`,
              name === 'revenue' ? 'CA réalisé' : 'Objectif',
            ]}
          />
          <Area
            type="monotone"
            dataKey="target"
            stroke="rgba(168,161,154,0.45)"
            strokeWidth={1.5}
            fill="url(#fillTgt)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#ff450f"
            strokeWidth={2}
            fill="url(#fillRev)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
