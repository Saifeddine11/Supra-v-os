import 'server-only';

import { getEmailFrom, getResendClient } from '@/lib/email/client';

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; skipped?: string; error?: string };

/**
 * Sends email via Resend. Never throws for missing config — returns skipped.
 */
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const client = getResendClient();
  const from = getEmailFrom();

  if (!client || !from) {
    if (!process.env.RESEND_API_KEY?.trim()) {
      console.warn('[email] RESEND_API_KEY missing — skip send.');
    } else if (!from) {
      console.warn('[email] EMAIL_FROM missing — skip send.');
    }
    return { ok: false, skipped: 'email_not_configured' };
  }

  const to = Array.isArray(opts.to) ? opts.to : [opts.to];
  if (to.length === 0 || to.some((t) => !t?.trim())) {
    return { ok: false, error: 'invalid_recipient' };
  }

  try {
    const { data, error } = await client.emails.send({
      from,
      to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) {
      console.error('[email] Resend error:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'send_failed';
    console.error('[email]', msg);
    return { ok: false, error: msg };
  }
}
