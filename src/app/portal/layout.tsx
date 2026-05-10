export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8 pb-12 sm:px-6 sm:py-10 sm:pb-14">{children}</div>
    </div>
  );
}
