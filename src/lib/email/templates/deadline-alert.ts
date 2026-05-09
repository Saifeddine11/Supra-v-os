import { emailButton, emailLayout, escapeHtml } from '@/lib/email/layout';

export type DeadlineAlertProps = {
  recipientName: string;
  entityTitle: string;
  entityType: string;
  clientName: string | null;
  deadline: string;
  priority: string;
  actionUrl: string;
};

export function deadlineAlertSubject() {
  return 'Alerte échéance — Supra v. Agency OS';
}

export function renderDeadlineAlertEmail(p: DeadlineAlertProps): { html: string; text: string } {
  const clientLine = p.clientName
    ? `<p style="margin:12px 0 0 0;color:#A8A19A;">Client : <span style="color:#F8F4EF;">${escapeHtml(p.clientName)}</span></p>`
    : '';

  const inner = `
    <p style="margin:0 0 8px 0;color:#F8F4EF;">Bonjour ${escapeHtml(p.recipientName)},</p>
    <p style="margin:0 0 16px 0;color:#A8A19A;font-size:14px;">Une échéance nécessite votre attention.</p>
    <p style="margin:0;font-size:18px;font-weight:600;color:#F8F4EF;">${escapeHtml(p.entityTitle)}</p>
    <p style="margin:8px 0 0 0;color:#A8A19A;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(p.entityType)}</p>
    ${clientLine}
    <p style="margin:16px 0 0 0;color:#F8F4EF;"><strong>Échéance :</strong> ${escapeHtml(p.deadline)}</p>
    <p style="margin:8px 0 0 0;color:#F8F4EF;"><strong>Priorité :</strong> ${escapeHtml(p.priority)}</p>
    ${emailButton(p.actionUrl, "Ouvrir l'élément")}
  `;

  const text = [
    `Bonjour ${p.recipientName},`,
    '',
    `${p.entityType}: ${p.entityTitle}`,
    p.clientName ? `Client : ${p.clientName}` : '',
    `Échéance : ${p.deadline}`,
    `Priorité : ${p.priority}`,
    '',
    p.actionUrl,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    html: emailLayout({
      title: deadlineAlertSubject(),
      preheader: `${p.entityType}: ${p.entityTitle}`,
      innerHtml: inner,
    }),
    text,
  };
}
