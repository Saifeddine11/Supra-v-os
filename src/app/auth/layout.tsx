import { Toaster } from 'sonner';

export default function AuthHelperLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-15%,color-mix(in_srgb,#ff450f_16%,transparent),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,hsl(0_0%_100%/0.03),transparent_50%)]"
        aria-hidden
      />
      {children}
      <Toaster
        theme="system"
        position="top-right"
        toastOptions={{ duration: 4500 }}
      />
    </div>
  );
}
