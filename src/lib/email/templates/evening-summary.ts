import { emailButton, emailLayout, escapeHtml } from '@/lib/email/layout';
import type { EveningDigest, EveningDigestLine } from '@/lib/cron/evening-summary-content';
import { OPERATIONAL } from '@/lib/ui/status-colors';

export type EveningSummaryEmailProps = {
  digest: EveningDigest;
  completedToday: EveningDigestLine[];
  dashboardUrl: string;
};

export function eveningSummarySubject(p?: Pick<EveningSummaryEmailProps, 'digest'>) {
  if (p?.digest.overdue.length) {
    return 'Vos priorités pour demain — Supra v. Agency OS';
  }
  return 'Résumé de fin de journée — Supra v. Agency OS';
}

function block(title: string, color: string, items: EveningDigestLine[]): string {
  if (!items.length) return '';
  const lis = items
    .map((row) => {
      const safe = escapeHtml(row.text);
      if (row.url) {
        return `<li style="margin:8px 0;"><a href="${escapeHtml(row.url)}" style="color:#F8F4EF;text-decoration:underline;">${safe}</a></li>`;
      }
      return `<li style="margin:8px 0;color:#F8F4EF;">${safe}</li>`;
    })
    .join('');
  return `
    <div style="margin:18px 0;padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);background:rgba(8,7,6,0.35);">
      <p style="margin:0 0 10px 0;font-size:12px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(title)}</p>
      <ul style="margin:0;padding-left:18px;">${lis}</ul>
    </div>`;
}

export function renderEveningSummaryEmail(p: EveningSummaryEmailProps): { html: string; text: string } {
  const { digest, completedToday, dashboardUrl } = p;
  const calm =
    digest.overdue.length === 0 &&
    digest.tomorrow.length === 0 &&
    digest.watch.length === 0 &&
    digest.finance.length === 0;

  const inner = `
    <p style="margin:0 0 8px 0;color:#F8F4EF;font-size:16px;">Bonsoir ${escapeHtml(digest.recipientFirstName)},</p>
    <p style="margin:0 0 16px 0;color:#A8A19A;font-size:14px;">${escapeHtml(digest.dateLabel)}</p>
    <p style="margin:0 0 18px 0;color:#A8A19A;font-size:14px;line-height:1.5;">
      Voici votre résumé de fin de journée — personnalisé selon votre rôle et vos assignations.
    </p>
    ${calm ? `<p style="margin:0 0 18px 0;padding:12px 14px;border-radius:10px;border:1px solid rgba(34,197,94,0.35);background:rgba(34,197,94,0.08);color:#BBF7D0;font-size:14px;">Aucune urgence critique listée pour demain. Gardez un œil sur les statuts et le portail.</p>` : ''}
    ${block('À terminer / en retard', OPERATIONAL.danger, digest.overdue)}
    ${block('Prévu demain', OPERATIONAL.urgent, digest.tomorrow)}
    ${block('À surveiller', OPERATIONAL.waitClient, digest.watch)}
    ${block('Finance / relances', OPERATIONAL.muted, digest.finance)}
    ${completedToday.length ? block('Traité aujourd’hui', OPERATIONAL.success, completedToday) : ''}
    <p style="margin:22px 0 0 0;color:#A8A19A;font-size:14px;line-height:1.55;">
      Bonne fin de journée, l’équipe Supra v.
    </p>
    ${emailButton(dashboardUrl, 'Ouvrir le dashboard')}
  `;

  const text = [
    `Bonsoir ${digest.recipientFirstName},`,
    '',
    digest.dateLabel,
    '',
    ...(digest.overdue.length ? ['En retard :', ...digest.overdue.map((l) => `• ${l.text}`), ''] : []),
    ...(digest.tomorrow.length ? ['Demain :', ...digest.tomorrow.map((l) => `• ${l.text}`), ''] : []),
    ...(digest.watch.length ? ['À surveiller :', ...digest.watch.map((l) => `• ${l.text}`), ''] : []),
    ...(digest.finance.length ? ['Finance :', ...digest.finance.map((l) => `• ${l.text}`), ''] : []),
    ...(completedToday.length ? ['Traité aujourd’hui :', ...completedToday.map((l) => `• ${l.text}`), ''] : []),
    calm ? 'Aucune urgence critique listée pour demain.' : '',
    '',
    dashboardUrl,
  ].join('\n');

  return {
    html: emailLayout({
      title: eveningSummarySubject({ digest }),
      preheader: digest.dateLabel,
      innerHtml: inner,
    }),
    text,
  };
}
