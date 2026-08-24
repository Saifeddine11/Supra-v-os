export function CockpitSkeleton() {
  return (
    <div className="space-y-10" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-3 w-40 animate-pulse rounded bg-muted/50" />
          <div className="h-8 w-48 animate-pulse rounded-lg bg-muted/60" />
          <div className="h-4 w-36 animate-pulse rounded bg-muted/40" />
        </div>
        <div className="h-10 w-[min(100%,22rem)] animate-pulse rounded-full bg-muted/40" />
      </div>
      <div className="grid gap-8 xl:grid-cols-[1.55fr_0.7fr]">
        <div className="space-y-6">
          <div className="h-12 w-56 animate-pulse rounded-lg bg-muted/50" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-muted/40" />
                <div className="h-7 w-16 animate-pulse rounded bg-muted/50" />
              </div>
            ))}
          </div>
        </div>
        <div className="h-56 animate-pulse rounded-3xl bg-muted/20" />
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-muted/15" />
      <div className="h-72 animate-pulse rounded-2xl bg-muted/15" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl bg-muted/15" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted/15" />
      </div>
    </div>
  );
}
