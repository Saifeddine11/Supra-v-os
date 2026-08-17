import { AppSidebar } from '@/components/app/app-sidebar';
import { AppTopbar } from '@/components/app/app-topbar';
import { AppShellToaster } from '@/components/app/app-shell-toaster';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/app/(app)/actions';
import { AGENCY } from '@/lib/constants';
import type { Employee, Notification } from '@/types/database';
import type { NotificationSoundPrefs } from '@/lib/notifications/notification-sound-prefs';
import { NotificationSoundBootstrap } from '@/components/app/notification-sound-bootstrap';
import { GlobalCriticalAlertBar } from '@/components/app/global-critical-alert-bar';
import { StickyAppHeader } from '@/components/app/sticky-app-header';
import { ShootingConfirmationHost } from '@/components/videos/shooting-confirmation-modal';
import type { ShootingConfirmQueueItem } from '@/lib/data/shooting-confirmation-queue';

export type AppShellMode = 'full' | 'password_gate';

export interface AppShellProps {
  employee: Employee;
  email: string;
  initialUnread: number;
  initialBellPreview: Notification[];
  notificationSoundPrefs: NotificationSoundPrefs;
  children: React.ReactNode;
  /** Tournages à confirmer — slot streamé (Suspense), ne bloque pas le layout. */
  shootingSlot?: React.ReactNode;
  /** @deprecated Prefer shootingSlot. Kept for password_gate / tests. */
  shootingConfirmQueue?: ShootingConfirmQueueItem[];
  /** auth.users id — snooze localStorage par utilisateur. */
  shootingConfirmUserId?: string | null;
  /** Sans navigation : changement de mot de passe obligatoire. */
  mode?: AppShellMode;
}

export function AppShell({
  employee,
  email,
  initialUnread,
  initialBellPreview,
  notificationSoundPrefs,
  children,
  shootingSlot = null,
  shootingConfirmQueue = [],
  shootingConfirmUserId = null,
  mode = 'full',
}: AppShellProps) {
  if (mode === 'password_gate') {
    return (
      <div className="relative min-h-screen bg-background">
        <div
          className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,color-mix(in_srgb,hsl(var(--orange-glow))_16%,transparent),transparent_55%)]"
          aria-hidden
        />
        <header className="relative z-20 flex items-center justify-between gap-3 border-b border-border/60 bg-card/60 px-4 py-3 backdrop-blur-md sm:px-6">
          <span className="min-w-0 truncate font-serif text-base font-medium text-supra-gradient sm:text-lg">
            {AGENCY.name}
          </span>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm" className="rounded-full text-muted-foreground">
                Déconnexion
              </Button>
            </form>
          </div>
        </header>
        <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-52px)] max-w-lg flex-col justify-center px-4 py-10 sm:min-h-[calc(100vh-52px)] sm:px-6">
          {children}
        </main>
        <AppShellToaster />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <NotificationSoundBootstrap />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,color-mix(in_srgb,hsl(var(--orange-glow))_16%,transparent),transparent_55%)]"
        aria-hidden
      />
      <AppSidebar employee={employee} email={email} />
      <div className="lg:pl-[272px]">
        <StickyAppHeader>
          <AppTopbar
            employee={employee}
            email={email}
            initialUnread={initialUnread}
            initialBellPreview={initialBellPreview}
            notificationSoundPrefs={notificationSoundPrefs}
          />
          <GlobalCriticalAlertBar />
        </StickyAppHeader>
        <main className="relative z-10 mx-auto max-w-[1600px] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
          {children}
        </main>
        {shootingSlot}
        {!shootingSlot && shootingConfirmUserId && shootingConfirmQueue.length > 0 ? (
          <ShootingConfirmationHost userId={shootingConfirmUserId} initialQueue={shootingConfirmQueue} />
        ) : null}
        <AppShellToaster />
      </div>
    </div>
  );
}
