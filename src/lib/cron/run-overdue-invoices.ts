import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { getCronEmailPrefs } from '@/lib/cron/user-notification-prefs';
import { createNotificationOnce } from '@/lib/notifications/notify';
import { joinedRelationName } from '@/lib/supabase/joined-name';
import { sendEmail } from '@/lib/email/send-email';
import { invoiceReminderSubject, renderInvoiceReminderEmail } from '@/lib/email/templates/invoice-reminder';
import { getAgencyDisplayCurrencyWithClient } from '@/lib/data/agency-settings-db';
import { formatAgencyMoneyCompact } from '@/lib/money/format-money';

export type OverdueInvoicesResult = {
  success: boolean;
  invoicesUpdated: number;
  notificationsCreated: number;
  skippedDuplicates: number;
  emailsSent: number;
  emailsSkipped: number;
  errors: string[];
};

export async function runOverdueInvoices(): Promise<OverdueInvoicesResult> {
  const errors: string[] = [];
  let invoicesUpdated = 0;
  let notificationsCreated = 0;
  let skippedDuplicates = 0;
  let emailsSent = 0;
  let emailsSkipped = 0;

  const admin = createAdminClient();
  const agencyCurrency = await getAgencyDisplayCurrencyWithClient(admin);
  const today = new Date().toISOString().slice(0, 10);
  const base = appBaseUrl();

  const { data: stale, error: fetchErr } = await admin
    .from('invoices')
    .select('id,ref,due_date,total,currency,client_id,clients(name)')
    .in('status', ['pending', 'sent'])
    .lt('due_date', today);

  if (fetchErr) {
    return {
      success: false,
      invoicesUpdated: 0,
      notificationsCreated: 0,
      skippedDuplicates: 0,
      emailsSent: 0,
      emailsSkipped: 0,
      errors: [fetchErr.message],
    };
  }

  const { data: finance } = await admin
    .from('employees')
    .select('user_id, email, full_name')
    .in('role', ['admin', 'commercial', 'finance'])
    .eq('is_active', true)
    .is('archived_at', null)
    .not('user_id', 'is', null);

  for (const inv of stale ?? []) {
    const { error: upErr } = await admin
      .from('invoices')
      .update({ status: 'overdue', updated_at: new Date().toISOString() })
      .eq('id', inv.id);
    if (upErr) {
      errors.push(upErr.message);
      continue;
    }
    invoicesUpdated += 1;

    const clientName = joinedRelationName(inv.clients) ?? '';
    const amountLabel = formatAgencyMoneyCompact(Number(inv.total), agencyCurrency);
    const msg = `${inv.ref} — ${amountLabel}${clientName ? ` — ${clientName}` : ''}`;

    for (const row of finance ?? []) {
      if (!row.user_id) continue;
      const payload = {
        recipient_user_id: row.user_id,
        type: 'invoice_overdue' as const,
        priority: 'urgent' as const,
        title: 'Facture en retard',
        message: msg,
        related_entity_type: 'invoice',
        related_entity_id: inv.id,
        link_url: `${base}/invoices`,
      };
      const { inserted } = await createNotificationOnce(payload, {
        recipientUserId: row.user_id,
        type: 'invoice_overdue',
        relatedEntityType: 'invoice',
        relatedEntityId: inv.id,
        windowHours: 48,
      });
      if (inserted) {
        notificationsCreated += 1;
        if (row.email?.trim()) {
          const prefs = await getCronEmailPrefs(admin, row.user_id);
          if (prefs.email_reminders_enabled) {
            const { html, text } = renderInvoiceReminderEmail({
              recipientName: row.full_name.split(/\s+/)[0] ?? row.full_name,
              invoiceRef: inv.ref,
              amount: amountLabel,
              dueDate: inv.due_date ?? '',
              status: 'En retard',
              invoiceUrl: `${base}/invoices`,
            });
            const r = await sendEmail({
              to: row.email,
              subject: invoiceReminderSubject(),
              html,
              text,
            });
            if (r.ok) emailsSent += 1;
            else if (r.skipped) emailsSkipped += 1;
            else if (r.error) errors.push(`${row.email}: ${r.error}`);
          }
        }
      } else skippedDuplicates += 1;
    }
  }

  return {
    success: errors.length === 0,
    invoicesUpdated,
    notificationsCreated,
    skippedDuplicates,
    emailsSent,
    emailsSkipped,
    errors,
  };
}
