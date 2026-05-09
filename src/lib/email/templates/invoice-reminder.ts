import { emailButton, emailLayout, escapeHtml } from '@/lib/email/layout';

export type InvoiceReminderProps = {
  recipientName: string;
  invoiceRef: string;
  amount: string;
  dueDate: string;
  status: string;
  invoiceUrl: string;
};

export function invoiceReminderSubject() {
  return 'Rappel facture — Supra v.';
}

export function renderInvoiceReminderEmail(p: InvoiceReminderProps): { html: string; text: string } {
  const inner = `
    <p style="margin:0 0 8px 0;color:#F8F4EF;">Bonjour ${escapeHtml(p.recipientName)},</p>
    <p style="margin:0 0 20px 0;color:#A8A19A;font-size:14px;">Rappel professionnel concernant la facture ci-dessous.</p>
    <table role="presentation" style="width:100%;border:1px solid rgba(248,244,239,0.12);border-radius:8px;padding:16px;margin:16px 0;">
      <tr><td style="color:#A8A19A;font-size:12px;">Référence</td></tr>
      <tr><td style="color:#F8F4EF;font-weight:600;padding-bottom:12px;">${escapeHtml(p.invoiceRef)}</td></tr>
      <tr><td style="color:#A8A19A;font-size:12px;">Montant</td></tr>
      <tr><td style="color:#F8F4EF;font-weight:600;padding-bottom:12px;">${escapeHtml(p.amount)}</td></tr>
      <tr><td style="color:#A8A19A;font-size:12px;">Échéance</td></tr>
      <tr><td style="color:#F8F4EF;font-weight:600;padding-bottom:12px;">${escapeHtml(p.dueDate)}</td></tr>
      <tr><td style="color:#A8A19A;font-size:12px;">Statut</td></tr>
      <tr><td style="color:#F8F4EF;">${escapeHtml(p.status)}</td></tr>
    </table>
    ${emailButton(p.invoiceUrl, 'Voir la facture')}
  `;

  const text = [
    `Bonjour ${p.recipientName},`,
    '',
    `Facture ${p.invoiceRef}`,
    `Montant : ${p.amount}`,
    `Échéance : ${p.dueDate}`,
    `Statut : ${p.status}`,
    '',
    p.invoiceUrl,
  ].join('\n');

  return {
    html: emailLayout({
      title: invoiceReminderSubject(),
      preheader: `Facture ${p.invoiceRef}`,
      innerHtml: inner,
    }),
    text,
  };
}
