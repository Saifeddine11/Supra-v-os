import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { requireAuth } from '@/lib/auth/permissions';
import { enforceRouteAccessForPathname } from '@/lib/auth/nav-access';
import { getUnreadNotificationsCount, listBellPreview } from '@/lib/data/notifications-user';
import { getMyNotificationPreferences } from '@/lib/data/notification-preferences';
import { notificationSoundPrefsFromRow } from '@/lib/notifications/notification-sound-prefs';
import { AppShell } from '@/components/app/app-shell';
import { StaffPasswordChangeGate } from '@/components/app/staff-password-change-gate';
import type { Notification } from '@/types/database';
import { fetchShootingConfirmationQueue } from '@/lib/data/shooting-confirmation-queue';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();
  const pathname = (await headers()).get('x-pathname') ?? '';
  await enforceRouteAccessForPathname(pathname);

  if (!ctx.employee) {
    redirect('/login?next=/dashboard');
  }

  const mustChangePassword = ctx.employee.must_change_password === true;

  let initialUnread = 0;
  let initialBellPreview: Notification[] = [];
  let notificationSoundPrefs = notificationSoundPrefsFromRow(null);
  if (!mustChangePassword) {
    const [unread, bellPreview, notifPrefs] = await Promise.all([
      getUnreadNotificationsCount(ctx),
      listBellPreview(8, ctx),
      ctx.userId ? getMyNotificationPreferences(ctx.userId) : Promise.resolve(null),
    ]);
    initialUnread = unread;
    initialBellPreview = bellPreview;
    notificationSoundPrefs = notificationSoundPrefsFromRow(notifPrefs);
  }

  let shootingConfirmQueue: Awaited<ReturnType<typeof fetchShootingConfirmationQueue>> = [];
  if (!mustChangePassword) {
    try {
      shootingConfirmQueue = await fetchShootingConfirmationQueue(ctx);
    } catch {
      shootingConfirmQueue = [];
    }
  }

  return (
    <StaffPasswordChangeGate mustChangePassword={mustChangePassword}>
      <AppShell
        mode={mustChangePassword ? 'password_gate' : 'full'}
        employee={ctx.employee}
        email={ctx.email}
        initialUnread={initialUnread}
        initialBellPreview={initialBellPreview}
        notificationSoundPrefs={notificationSoundPrefs}
        shootingConfirmQueue={shootingConfirmQueue}
        shootingConfirmUserId={ctx.userId}
      >
        {children}
      </AppShell>
    </StaffPasswordChangeGate>
  );
}
