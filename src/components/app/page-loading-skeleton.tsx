export function PageLoadingSkeleton({
  titleWidth = 'w-40',
}: {
  titleWidth?: string;
}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className={`h-8 ${titleWidth} animate-pulse rounded-lg bg-muted/50`} />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted/30" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="h-28 animate-pulse rounded-2xl border border-border/50 bg-muted/25" />
        <div className="h-28 animate-pulse rounded-2xl border border-border/50 bg-muted/25" />
        <div className="h-28 animate-pulse rounded-2xl border border-border/50 bg-muted/25" />
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-border/50 bg-muted/20" />
    </div>
  );
}
