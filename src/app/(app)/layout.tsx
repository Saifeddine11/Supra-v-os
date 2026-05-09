import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/permissions';
import { getUnreadNotificationsCount, listBellPreview } from '@/lib/data/notifications-user';
import { AppShell } from '@/components/app/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();
  if (!ctx.employee) {
    redirect('/login?next=/dashboard');
  }

  const [initialUnread, initialBellPreview] = await Promise.all([
    getUnreadNotificationsCount(ctx),
    listBellPreview(8, ctx),
  ]);

  return (
    <AppShell
      employee={ctx.employee}
      email={ctx.email}
      initialUnread={initialUnread}
      initialBellPreview={initialBellPreview}
    >
      {children}
    </AppShell>
  );
}
