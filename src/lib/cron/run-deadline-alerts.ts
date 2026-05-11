import 'server-only';

import { addDays, endOfDay, format, startOfDay } from 'date-fns';
import { createAdminClient } from '@/lib/supabase/admin';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { sendEmail } from '@/lib/email/send-email';
import {
  deadlineAlertSubject,
  renderDeadlineAlertEmail,
} from '@/lib/email/templates/deadline-alert';
import {
  quoteExpiringSubject,
  renderQuoteExpiringEmail,
} from '@/lib/email/templates/quote-expiring';
import { createNotificationOnce, getEmployeeUserId } from '@/lib/notifications/notify';
import { joinedRelationName } from '@/lib/supabase/joined-name';
import { getCronEmailPrefs } from '@/lib/cron/user-notification-prefs';
import { getAgencyDisplayCurrencyWithClient } from '@/lib/data/agency-settings-db';
import { formatAgencyMoneyCompact } from '@/lib/money/format-money';

export type DeadlineAlertsResult = {
  success: boolean;
  notificationsCreated: number;
  skippedDuplicates: number;
  emailsSent: number;
  emailsSkipped: number;
  errors: string[];
};

const DEDUPE_H = 20;

export async function runDeadlineAlerts(): Promise<DeadlineAlertsResult> {
  const errors: string[] = [];
  let notificationsCreated = 0;
  let skippedDuplicates = 0;
  let emailsSent = 0;
  let emailsSkipped = 0;
  const admin = createAdminClient();
  const agencyCurrency = await getAgencyDisplayCurrencyWithClient(admin);
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600_000);
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowStr = addDays(now, 1).toISOString().slice(0, 10);
  const base = appBaseUrl();

  async function notifyUser(opts: {
    userId: string;
    type: 'task_deadline_approaching' | 'task_overdue' | 'deadline_soon' | 'invoice_due_soon' | 'invoice_overdue' | 'quote_expiring';
    priority: 'normal' | 'high' | 'urgent';
    title: string;
    message: string;
    entityType: string;
    entityId: string;
    linkUrl: string;
    email?: { to: string; name: string; entityTitle: string; entityLabel: string; clientName: string | null; deadline: string; priority: string };
  }) {
    const prefs = await getCronEmailPrefs(admin, opts.userId);
    if (!prefs.deadline_alerts_enabled) {
      return;
    }

    const row = {
      recipient_user_id: opts.userId,
      type: opts.type,
      priority: opts.priority,
      title: opts.title,
      message: opts.message,
      related_entity_type: opts.entityType,
      related_entity_id: opts.entityId,
      link_url: opts.linkUrl,
    };
    const { inserted } = await createNotificationOnce(row, {
      recipientUserId: opts.userId,
      type: opts.type,
      relatedEntityType: opts.entityType,
      relatedEntityId: opts.entityId,
      windowHours: DEDUPE_H,
    });
    if (inserted) notificationsCreated += 1;
    else skippedDuplicates += 1;

    if (inserted && opts.email && prefs.email_reminders_enabled) {
      const { html, text } = renderDeadlineAlertEmail({
        recipientName: opts.email.name,
        entityTitle: opts.email.entityTitle,
        entityType: opts.email.entityLabel,
        clientName: opts.email.clientName,
        deadline: opts.email.deadline,
        priority: opts.email.priority,
        actionUrl: opts.linkUrl.startsWith('http') ? opts.linkUrl : `${base}${opts.linkUrl}`,
      });
      const r = await sendEmail({
        to: opts.email.to,
        subject: deadlineAlertSubject(),
        html,
        text,
      });
      if (r.ok) emailsSent += 1;
      else if (r.skipped) emailsSkipped += 1;
      else if (r.error) errors.push(`email ${opts.email.to}: ${r.error}`);
    }
  }

  // Tasks due in 24h (not overdue yet)
  const { data: tasksSoon } = await admin
    .from('tasks')
    .select('id,title,deadline,assignee_id,priority,client_id,clients(name)')
    .not('status', 'in', '(done,archived)')
    .not('deadline', 'is', null)
    .gt('deadline', now.toISOString())
    .lte('deadline', in24h.toISOString());

  for (const t of tasksSoon ?? []) {
    const uid = await getEmployeeUserId(t.assignee_id);
    if (!uid) continue;
    const { data: emp } = await admin.from('employees').select('email,full_name').eq('id', t.assignee_id!).maybeSingle();
    const clientName = joinedRelationName(t.clients);
    const dl = format(new Date(t.deadline!), "d MMM yyyy HH:mm");
    await notifyUser({
      userId: uid,
      type: 'task_deadline_approaching',
      priority: t.priority === 'urgent' ? 'urgent' : 'normal',
      title: 'Tâche à échéance sous 24h',
      message: t.title,
      entityType: 'task',
      entityId: t.id,
      linkUrl: `${base}/tasks`,
      email: emp
        ? {
            to: emp.email,
            name: emp.full_name.split(/\s+/)[0] ?? emp.full_name,
            entityTitle: t.title,
            entityLabel: 'Tâche',
            clientName,
            deadline: dl,
            priority: t.priority,
          }
        : undefined,
    });
  }

  // Overdue tasks
  const { data: tasksOver } = await admin
    .from('tasks')
    .select('id,title,deadline,assignee_id,priority,client_id,clients(name)')
    .not('status', 'in', '(done,archived)')
    .not('deadline', 'is', null)
    .lt('deadline', now.toISOString());

  for (const t of tasksOver ?? []) {
    const uid = await getEmployeeUserId(t.assignee_id);
    if (!uid) continue;
    const { data: emp } = await admin.from('employees').select('email,full_name').eq('id', t.assignee_id!).maybeSingle();
    const clientName = joinedRelationName(t.clients);
    const dl = format(new Date(t.deadline!), "d MMM yyyy HH:mm");
    await notifyUser({
      userId: uid,
      type: 'task_overdue',
      priority: 'urgent',
      title: 'Tâche en retard',
      message: t.title,
      entityType: 'task',
      entityId: t.id,
      linkUrl: `${base}/tasks`,
      email: emp
        ? {
            to: emp.email,
            name: emp.full_name.split(/\s+/)[0] ?? emp.full_name,
            entityTitle: t.title,
            entityLabel: 'Tâche',
            clientName,
            deadline: dl,
            priority: t.priority,
          }
        : undefined,
    });
  }

  // Vidéos : delivery_deadline (jour) et/ou client_delivery_at (timestamptz)
  const tomorrowDay = addDays(now, 1);
  const soonAtStart = startOfDay(now).toISOString();
  const soonAtEnd = endOfDay(tomorrowDay).toISOString();
  const todayStart = startOfDay(now).toISOString();

  const { data: videosSoonDate } = await admin
    .from('videos')
    .select('id,title,delivery_deadline,client_delivery_at,editor_id,client_id,clients(name)')
    .not('status', 'in', '(published,archived,cancelled)')
    .not('delivery_deadline', 'is', null)
    .gte('delivery_deadline', todayStr)
    .lte('delivery_deadline', tomorrowStr);

  const { data: videosSoonAt } = await admin
    .from('videos')
    .select('id,title,delivery_deadline,client_delivery_at,editor_id,client_id,clients(name)')
    .not('status', 'in', '(published,archived,cancelled)')
    .not('client_delivery_at', 'is', null)
    .gte('client_delivery_at', soonAtStart)
    .lte('client_delivery_at', soonAtEnd);

  const soonSeen = new Set<string>();
  for (const v of [...(videosSoonDate ?? []), ...(videosSoonAt ?? [])]) {
    if (soonSeen.has(v.id)) continue;
    soonSeen.add(v.id);
    const uid = await getEmployeeUserId(v.editor_id);
    if (!uid) continue;
    const { data: emp } = await admin.from('employees').select('email,full_name').eq('id', v.editor_id!).maybeSingle();
    const clientName = joinedRelationName(v.clients);
    const deadlineLabel = (v.client_delivery_at ?? v.delivery_deadline ?? '') as string;
    await notifyUser({
      userId: uid,
      type: 'deadline_soon',
      priority: 'high',
      title: 'Échéance vidéo imminente',
      message: v.title,
      entityType: 'video',
      entityId: v.id,
      linkUrl: `${base}/videos`,
      email: emp
        ? {
            to: emp.email,
            name: emp.full_name.split(/\s+/)[0] ?? emp.full_name,
            entityTitle: v.title,
            entityLabel: 'Vidéo',
            clientName,
            deadline: deadlineLabel,
            priority: 'high',
          }
        : undefined,
    });
  }

  const { data: videosOverDate } = await admin
    .from('videos')
    .select('id,title,delivery_deadline,client_delivery_at,editor_id,client_id,clients(name)')
    .not('status', 'in', '(published,archived,cancelled)')
    .not('delivery_deadline', 'is', null)
    .lt('delivery_deadline', todayStr);

  const { data: videosOverAt } = await admin
    .from('videos')
    .select('id,title,delivery_deadline,client_delivery_at,editor_id,client_id,clients(name)')
    .not('status', 'in', '(published,archived,cancelled)')
    .not('client_delivery_at', 'is', null)
    .lt('client_delivery_at', todayStart);

  const overSeen = new Set<string>();
  for (const v of [...(videosOverDate ?? []), ...(videosOverAt ?? [])]) {
    if (overSeen.has(v.id)) continue;
    overSeen.add(v.id);
    const uid = await getEmployeeUserId(v.editor_id);
    if (!uid) continue;
    const { data: emp } = await admin.from('employees').select('email,full_name').eq('id', v.editor_id!).maybeSingle();
    const clientName = joinedRelationName(v.clients);
    const deadlineLabel = (v.client_delivery_at ?? v.delivery_deadline ?? '') as string;
    await notifyUser({
      userId: uid,
      type: 'deadline_soon',
      priority: 'urgent',
      title: 'Livraison vidéo en retard',
      message: v.title,
      entityType: 'video',
      entityId: v.id,
      linkUrl: `${base}/videos`,
      email: emp
        ? {
            to: emp.email,
            name: emp.full_name.split(/\s+/)[0] ?? emp.full_name,
            entityTitle: v.title,
            entityLabel: 'Vidéo',
            clientName,
            deadline: deadlineLabel,
            priority: 'urgent',
          }
        : undefined,
    });
  }

  // Invoices due tomorrow (date field)
  const { data: invSoon } = await admin
    .from('invoices')
    .select('id,ref,due_date,total,currency,client_id,clients(name)')
    .in('status', ['sent', 'pending', 'draft'])
    .eq('due_date', tomorrowStr);

  const { data: financeRows } = await admin
    .from('employees')
    .select('user_id,email,full_name')
    .in('role', ['admin', 'commercial', 'finance'])
    .eq('is_active', true)
    .is('archived_at', null)
    .not('user_id', 'is', null);
  const financeUsers = financeRows ?? [];

  for (const inv of invSoon ?? []) {
    const clientName = joinedRelationName(inv.clients);
    const msg = `${inv.ref} — ${formatAgencyMoneyCompact(Number(inv.total), agencyCurrency)}`;
    for (const fu of financeUsers) {
      if (!fu.user_id) continue;
      await notifyUser({
        userId: fu.user_id,
        type: 'invoice_due_soon',
        priority: 'high',
        title: 'Facture bientôt échue',
        message: msg,
        entityType: 'invoice',
        entityId: inv.id,
        linkUrl: `${base}/invoices`,
        email: fu.email
          ? {
              to: fu.email,
              name: fu.full_name.split(/\s+/)[0] ?? fu.full_name,
              entityTitle: inv.ref,
              entityLabel: 'Facture',
              clientName,
              deadline: inv.due_date,
              priority: 'high',
            }
          : undefined,
      });
    }
  }

  // Quotes expiring in 3 days
  const in3 = addDays(now, 3).toISOString().slice(0, 10);
  const { data: quotesExp } = await admin
    .from('quotes')
    .select('id,ref,valid_until,total,currency,client_id,clients(name)')
    .in('status', ['draft', 'sent'])
    .gte('valid_until', todayStr)
    .lte('valid_until', in3);

  for (const q of quotesExp ?? []) {
    const clientName = joinedRelationName(q.clients) ?? '';
    const msg = `${q.ref} — validité jusqu'au ${q.valid_until}`;
    const amountStr = formatAgencyMoneyCompact(Number(q.total), agencyCurrency);
    for (const fu of financeUsers) {
      if (!fu.user_id) continue;
      const row = {
        recipient_user_id: fu.user_id,
        type: 'quote_expiring' as const,
        priority: 'normal' as const,
        title: 'Devis arrive à échéance',
        message: msg,
        related_entity_type: 'quote',
        related_entity_id: q.id,
        link_url: `${base}/quotes/${q.id}`,
      };
      const { inserted } = await createNotificationOnce(row, {
        recipientUserId: fu.user_id,
        type: 'quote_expiring',
        relatedEntityType: 'quote',
        relatedEntityId: q.id,
        windowHours: DEDUPE_H * 2,
      });
      if (inserted) notificationsCreated += 1;
      else skippedDuplicates += 1;

      if (inserted && fu.email?.trim()) {
        const prefs = await getCronEmailPrefs(admin, fu.user_id);
        if (prefs.email_reminders_enabled && prefs.deadline_alerts_enabled) {
          const { html, text } = renderQuoteExpiringEmail({
            recipientName: fu.full_name.split(/\s+/)[0] ?? fu.full_name,
            quoteRef: q.ref,
            clientName: clientName || '—',
            validUntil: q.valid_until ?? '',
            amount: amountStr,
            quoteUrl: `${base}/quotes/${q.id}`,
          });
          const r = await sendEmail({
            to: fu.email,
            subject: quoteExpiringSubject(),
            html,
            text,
          });
          if (r.ok) emailsSent += 1;
          else if (r.skipped) emailsSkipped += 1;
          else if (r.error) errors.push(`quote email ${fu.email}: ${r.error}`);
        }
      }
    }
  }

  return {
    success: errors.length === 0,
    notificationsCreated,
    skippedDuplicates,
    emailsSent,
    emailsSkipped,
    errors,
  };
}
