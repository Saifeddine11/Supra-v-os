'use client';

export type ChartLegendPill = {
  key: string;
  label: string;
  color: string;
};

export function ChartLegendPills({ items }: { items: ChartLegendPill[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2 sm:gap-2.5">
      {items.map((item) => (
        <span
          key={item.key}
          className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm"
        >
          <span className="h-2 w-2 shrink-0 rounded-full ring-2 ring-background/80" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
