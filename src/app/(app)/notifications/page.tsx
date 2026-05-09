import type { Metadata } from 'next';
import { Bell } from 'lucide-react';
import { requireAuth } from '@/lib/auth/permissions';
import { listNotificationsForPage, getUnreadNotificationsCount } from '@/lib/data/notifications-user';
import type { NotificationType } from '@/types/database';
import { SectionCard } from '@/components/shared/section-card';
import { NotificationsClient } from './notifications-client';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ f?: string; type?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const tab = sp.f === 'unread' || sp.f === 'urgent' ? sp.f : 'all';
  const typeFilter = (sp.type as NotificationType | undefined) ?? undefined;
  const validTypes: NotificationType[] = [
    'task_assigned',
    'task_overdue',
    'task_deadline_approaching',
    'deadline_soon',
    'client_validated',
    'client_revision_requested',
    'invoice_overdue',
    'invoice_due_soon',
    'invoice_sent',
    'invoice_paid',
    'quote_accepted',
    'quote_expiring',
    'quote_converted',
    'quota_incomplete',
    'employee_overloaded',
    'employee_task_not_updated',
    'report_due',
    'comment_added',
    'document_uploaded',
    'morning_summary',
    'evening_summary',
    'system',
  ];
  const type =
    typeFilter && validTypes.includes(typeFilter) ? typeFilter : null;

  const nCtx = await requireAuth();
  const [notifications, unreadTotal] = await Promise.all([
    listNotificationsForPage({ tab, type }, nCtx),
    getUnreadNotificationsCount(nCtx),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-sans text-2xl font-semibold tracking-tight text-foreground">
          <Bell className="h-7 w-7 text-primary" />
          Notifications
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Centre d&apos;alertes — rappels métiers, échéances et événements portail.
          {unreadTotal > 0 ? (
            <span className="ml-2 font-medium text-primary">{unreadTotal} non lue(s)</span>
          ) : null}
        </p>
      </div>

      <SectionCard title="Fil" description="Filtrez par statut ou par type d&apos;événement.">
        <NotificationsClient
          notifications={notifications}
          unreadTotal={unreadTotal}
          activeFilter={tab}
        />
      </SectionCard>
    </div>
  );
}
