import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { requireAuth } from '@/lib/auth/permissions';
import { enforceRouteAccessForPathname } from '@/lib/auth/nav-access';
import { AUTH_SET_PASSWORD_PATH } from '@/lib/auth/password-setup';
import { getClientAuthState } from '@/lib/clients/session';
import { CLIENT_HOME_PATH } from '@/lib/clients/auth-errors';
import { notificationSoundPrefsFromRow } from '@/lib/notifications/notification-sound-prefs';
import { AppShell } from '@/components/app/app-shell';
import { StaffPasswordChangeGate } from '@/components/app/staff-password-change-gate';
import { ShootingConfirmationSlot } from '@/components/app/shooting-confirmation-slot';
import { LoginPerfBeacon } from '@/components/app/login-perf-beacon';
import { isMinimalDashboardEnabled, perfLog, perfMs } from '@/lib/perf/dev-time';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const layoutStart = performance.now();
  const ctx = await requireAuth();
  const pathname = (await headers()).get('x-pathname') ?? '';
  await enforceRouteAccessForPathname(pathname, ctx);

  if (!ctx.employee) {
    const clientState = await getClientAuthState();
    if (clientState.kind === 'ok') {
      redirect(clientState.ctx.mustChangePassword ? AUTH_SET_PASSWORD_PATH : CLIENT_HOME_PATH);
    }
    if (clientState.kind === 'inactive') {
      redirect('/api/auth/client-logout?error=disabled');
    }
    redirect('/login?next=/dashboard');
  }

  const mustChangePassword = ctx.employee.must_change_password === true;
  perfLog('[perf] notifications: deferred (after shell)');
  perfLog(`[perf] app layout total: ${perfMs(layoutStart)} ms`);

  return (
    <StaffPasswordChangeGate mustChangePassword={mustChangePassword}>
      <AppShell
        mode={mustChangePassword ? 'password_gate' : 'full'}
        employee={ctx.employee}
        email={ctx.email}
        initialUnread={0}
        initialBellPreview={[]}
        notificationSoundPrefs={notificationSoundPrefsFromRow(null)}
        showCriticalAlerts={!isMinimalDashboardEnabled()}
        shootingSlot={
          !mustChangePassword && ctx.userId ? <ShootingConfirmationSlot userId={ctx.userId} /> : null
        }
      >
        {pathname === '/dashboard' ? <LoginPerfBeacon label="dashboard shell rendered" /> : null}
        {children}
      </AppShell>
    </StaffPasswordChangeGate>
  );
}
