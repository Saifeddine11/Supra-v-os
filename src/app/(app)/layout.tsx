import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/permissions';
import { getUnreadNotificationsCount, listBellPreview } from '@/lib/data/notifications-user';
import { AppShell } from '@/components/app/app-shell';
import { StaffPasswordChangeGate } from '@/components/app/staff-password-change-gate';
import type { Notification } from '@/types/database';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();
  if (!ctx.employee) {
    redirect('/login?next=/dashboard');
  }

  const mustChangePassword = ctx.employee.must_change_password === true;

  let initialUnread = 0;
  let initialBellPreview: Notification[] = [];
  if (!mustChangePassword) {
    [initialUnread, initialBellPreview] = await Promise.all([
      getUnreadNotificationsCount(ctx),
      listBellPreview(8, ctx),
    ]);
  }

  return (
    <StaffPasswordChangeGate mustChangePassword={mustChangePassword}>
      <AppShell
        mode={mustChangePassword ? 'password_gate' : 'full'}
        employee={ctx.employee}
        email={ctx.email}
        initialUnread={initialUnread}
        initialBellPreview={initialBellPreview}
      >
        {children}
      </AppShell>
    </StaffPasswordChangeGate>
  );
}
