import { AppSidebar } from '@/components/app/app-sidebar';
import { AppTopbar } from '@/components/app/app-topbar';
import type { Employee, Notification } from '@/types/database';

export interface AppShellProps {
  employee: Employee;
  email: string;
  initialUnread: number;
  initialBellPreview: Notification[];
  children: React.ReactNode;
}

export function AppShell({ employee, email, initialUnread, initialBellPreview, children }: AppShellProps) {
  return (
    <div className="relative min-h-screen bg-background">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,color-mix(in_srgb,hsl(var(--orange-glow))_16%,transparent),transparent_55%)]"
        aria-hidden
      />
      <AppSidebar employee={employee} email={email} />
      <div className="lg:pl-[272px]">
        <AppTopbar
          employee={employee}
          email={email}
          initialUnread={initialUnread}
          initialBellPreview={initialBellPreview}
        />
        <main className="relative z-10 mx-auto max-w-[1600px] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
