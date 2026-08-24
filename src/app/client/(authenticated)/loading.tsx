export default function ClientWorkspaceLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-white/[0.06]" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.05]" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
    </div>
  );
}
