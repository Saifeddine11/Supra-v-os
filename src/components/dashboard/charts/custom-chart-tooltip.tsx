'use client';

export type ChartTooltipRow = {
  key: string;
  label: string;
  value: string;
  color: string;
};

export function DashboardChartTooltip({
  active,
  title,
  rows,
}: {
  active?: boolean;
  title?: string;
  rows: ChartTooltipRow[];
}) {
  if (!active || !rows.length) return null;

  return (
    <div
      className="rounded-xl border px-3 py-2.5 text-xs shadow-lg backdrop-blur-md"
      style={{
        borderColor: 'var(--chart-card-border)',
        background: 'var(--chart-card-bg)',
        boxShadow: 'var(--chart-card-shadow)',
      }}
    >
      {title ? <p className="mb-2 font-semibold text-foreground">{title}</p> : null}
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
              {r.label}
            </span>
            <span className="shrink-0 tabular-nums font-medium text-foreground">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
