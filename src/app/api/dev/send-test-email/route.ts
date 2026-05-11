import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageEmployees } from '@/lib/auth/capabilities';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { sendEmail } from '@/lib/email/send-email';
import { renderMorningReminderEmail, morningReminderSubject } from '@/lib/email/templates/morning-reminder';
import { renderDeadlineAlertEmail, deadlineAlertSubject } from '@/lib/email/templates/deadline-alert';
import { renderEveningSummaryEmail, eveningSummarySubject } from '@/lib/email/templates/evening-summary';
import { renderInvoiceReminderEmail, invoiceReminderSubject } from '@/lib/email/templates/invoice-reminder';
import { renderClientFeedbackEmail, clientFeedbackSubject } from '@/lib/email/templates/client-feedback';
import { renderQuoteExpiringEmail, quoteExpiringSubject } from '@/lib/email/templates/quote-expiring';
import {
  morningReminderSample,
  deadlineAlertSample,
  eveningSummarySample,
  invoiceReminderSample,
  clientFeedbackSample,
  quoteExpiringSample,
} from '@/lib/email/sample-props';

export const runtime = 'nodejs';

const TEMPLATES = ['morning', 'deadline', 'evening', 'invoice', 'feedback', 'quote'] as const;
type TemplateId = (typeof TEMPLATES)[number];

/**
 * Admin-only: send one fixture email to the logged-in admin’s Auth email.
 * Does not expose RESEND_API_KEY. Requires Resend + EMAIL_FROM for real delivery.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!canManageEmployees(ctx.role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const to = ctx.email?.trim();
  if (!to) {
    return NextResponse.json({ ok: false, error: 'no_email_on_account' }, { status: 400 });
  }

  let body: { template?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const raw = (body.template ?? 'morning').toLowerCase();
  if (!TEMPLATES.includes(raw as TemplateId)) {
    return NextResponse.json(
      { ok: false, error: 'unknown_template', allowed: TEMPLATES },
      { status: 400 },
    );
  }
  const template = raw as TemplateId;

  const base = appBaseUrl();
  const recipientName = ctx.employee?.full_name?.split(/\s+/)[0] ?? 'Admin';

  let subject: string;
  let html: string;
  let text: string;

  switch (template) {
    case 'morning': {
      const p = morningReminderSample(base, recipientName);
      ({ html, text } = renderMorningReminderEmail(p));
      subject = morningReminderSubject();
      break;
    }
    case 'deadline': {
      const p = deadlineAlertSample(base, recipientName);
      ({ html, text } = renderDeadlineAlertEmail(p));
      subject = deadlineAlertSubject();
      break;
    }
    case 'evening': {
      const p = eveningSummarySample(base, recipientName);
      ({ html, text } = renderEveningSummaryEmail(p));
      subject = eveningSummarySubject({ digest: p.digest });
      break;
    }
    case 'invoice': {
      const p = invoiceReminderSample(base, recipientName);
      ({ html, text } = renderInvoiceReminderEmail(p));
      subject = invoiceReminderSubject();
      break;
    }
    case 'feedback': {
      const p = clientFeedbackSample(base, recipientName);
      ({ html, text } = renderClientFeedbackEmail(p));
      subject = clientFeedbackSubject();
      break;
    }
    case 'quote': {
      const p = quoteExpiringSample(base, recipientName);
      ({ html, text } = renderQuoteExpiringEmail(p));
      subject = quoteExpiringSubject();
      break;
    }
  }

  const r = await sendEmail({ to, subject, html, text });
  if (!r.ok) {
    if ('skipped' in r && r.skipped) {
      return NextResponse.json({
        ok: true,
        success: false,
        skipped: true,
        detail: r.skipped,
        template,
      });
    }
    return NextResponse.json({
      ok: false,
      success: false,
      error: r.error ?? 'send_failed',
      template,
    });
  }
  return NextResponse.json({
    ok: true,
    success: true,
    template,
    id: r.id,
  });
}
