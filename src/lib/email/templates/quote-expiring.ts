import { emailButton, emailLayout, escapeHtml } from '@/lib/email/layout';

export type QuoteExpiringProps = {
  recipientName: string;
  quoteRef: string;
  clientName: string;
  validUntil: string;
  amount: string;
  quoteUrl: string;
};

export function quoteExpiringSubject() {
  return 'Devis proche échéance — Supra v. Agency OS';
}

export function renderQuoteExpiringEmail(p: QuoteExpiringProps): { html: string; text: string } {
  const inner = `
    <p style="margin:0 0 8px 0;color:#F8F4EF;">Bonjour ${escapeHtml(p.recipientName)},</p>
    <p style="margin:0 0 20px 0;color:#A8A19A;font-size:14px;">Un devis approche de sa date de validité.</p>
    <p style="margin:0;font-weight:600;color:#F8F4EF;">${escapeHtml(p.quoteRef)}</p>
    <p style="margin:8px 0 0 0;color:#A8A19A;">Client : ${escapeHtml(p.clientName)}</p>
    <p style="margin:8px 0 0 0;color:#F8F4EF;">Validité jusqu'au : ${escapeHtml(p.validUntil)}</p>
    <p style="margin:8px 0 0 0;color:#F8F4EF;">Montant : ${escapeHtml(p.amount)}</p>
    ${emailButton(p.quoteUrl, 'Voir le devis')}
  `;

  const text = [
    `Bonjour ${p.recipientName},`,
    '',
    `Devis ${p.quoteRef}`,
    `Client : ${p.clientName}`,
    `Validité jusqu'au : ${p.validUntil}`,
    `Montant : ${p.amount}`,
    '',
    p.quoteUrl,
  ].join('\n');

  return {
    html: emailLayout({
      title: quoteExpiringSubject(),
      preheader: `${p.quoteRef} — validité ${p.validUntil}`,
      innerHtml: inner,
    }),
    text,
  };
}
