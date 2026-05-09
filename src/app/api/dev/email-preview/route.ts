import { NextResponse } from 'next/server';
import { renderMorningReminderEmail } from '@/lib/email/templates/morning-reminder';
import { renderDeadlineAlertEmail } from '@/lib/email/templates/deadline-alert';
import { renderEveningSummaryEmail } from '@/lib/email/templates/evening-summary';
import { renderInvoiceReminderEmail } from '@/lib/email/templates/invoice-reminder';
import { renderClientFeedbackEmail } from '@/lib/email/templates/client-feedback';
import { renderQuoteExpiringEmail } from '@/lib/email/templates/quote-expiring';
import { emailLayout } from '@/lib/email/layout';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import {
  morningReminderSample,
  deadlineAlertSample,
  eveningSummarySample,
  invoiceReminderSample,
  clientFeedbackSample,
  quoteExpiringSample,
} from '@/lib/email/sample-props';

export const runtime = 'nodejs';

/**
 * Development-only HTML preview for transactional emails.
 * Example: /api/dev/email-preview?t=morning
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const t = searchParams.get('t') ?? 'morning';
  const base = appBaseUrl();
  const name = 'Yasmine';

  let html: string;
  switch (t) {
    case 'morning':
      html = renderMorningReminderEmail(morningReminderSample(base, name)).html;
      break;
    case 'deadline':
      html = renderDeadlineAlertEmail(deadlineAlertSample(base, name)).html;
      break;
    case 'evening':
      html = renderEveningSummaryEmail(eveningSummarySample(base, name)).html;
      break;
    case 'invoice':
      html = renderInvoiceReminderEmail(invoiceReminderSample(base, 'Équipe finance')).html;
      break;
    case 'feedback':
      html = renderClientFeedbackEmail(clientFeedbackSample(base, 'Samir')).html;
      break;
    case 'quote':
      html = renderQuoteExpiringEmail(quoteExpiringSample(base, 'Samir')).html;
      break;
    default:
      html = emailLayout({
        title: 'Preview',
        innerHtml:
          '<p>Modèle inconnu. Utilisez <code>?t=morning|deadline|evening|invoice|feedback|quote</code></p>',
      });
  }

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
