import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { getCronEmailPrefs } from '@/lib/cron/user-notification-prefs';
import { sendEmail } from '@/lib/email/send-email';
import { clientFeedbackSubject, renderClientFeedbackEmail } from '@/lib/email/templates/client-feedback';

export async function emailStaffAboutClientFeedback(opts: {
  clientName: string;
  entityTitle: string;
  feedbackType: 'approved' | 'revision_requested';
  comment: string | null;
  entityPath: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: staff } = await admin
    .from('employees')
    .select('user_id, email, full_name')
    .in('role', ['admin', 'project_manager'])
    .eq('is_active', true)
    .is('archived_at', null);

  const base = appBaseUrl();
  const actionUrl = `${base}${opts.entityPath.startsWith('/') ? opts.entityPath : `/${opts.entityPath}`}`;

  for (const row of staff ?? []) {
    if (!row.email?.trim() || !row.user_id) continue;
    const prefs = await getCronEmailPrefs(admin, row.user_id);
    if (!prefs.email_reminders_enabled) continue;
    const { html, text } = renderClientFeedbackEmail({
      recipientName: row.full_name.split(/\s+/)[0] ?? row.full_name,
      clientName: opts.clientName,
      entityTitle: opts.entityTitle,
      feedbackType: opts.feedbackType,
      comment: opts.comment,
      actionUrl,
    });
    await sendEmail({
      to: row.email,
      subject: clientFeedbackSubject(),
      html,
      text,
    });
  }
}
