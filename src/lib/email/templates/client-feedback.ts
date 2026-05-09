import { emailButton, emailLayout, escapeHtml } from '@/lib/email/layout';

export type ClientFeedbackProps = {
  recipientName: string;
  clientName: string;
  entityTitle: string;
  feedbackType: 'approved' | 'revision_requested';
  comment: string | null;
  actionUrl: string;
};

export function clientFeedbackSubject() {
  return 'Retour client — Supra v. Agency OS';
}

export function renderClientFeedbackEmail(p: ClientFeedbackProps): { html: string; text: string } {
  const label =
    p.feedbackType === 'approved' ? 'Validé par le client' : 'Révision demandée par le client';
  const commentBlock = p.comment
    ? `<p style="margin:16px 0 0 0;padding:14px;border-left:3px solid #FF3D0A;background:rgba(255,61,10,0.06);color:#F8F4EF;font-size:14px;">${escapeHtml(p.comment)}</p>`
    : '';

  const inner = `
    <p style="margin:0 0 8px 0;color:#F8F4EF;">Bonjour ${escapeHtml(p.recipientName)},</p>
    <p style="margin:0 0 16px 0;color:#A8A19A;font-size:14px;">${escapeHtml(label)}</p>
    <p style="margin:0;color:#F8F4EF;"><strong>Client :</strong> ${escapeHtml(p.clientName)}</p>
    <p style="margin:8px 0 0 0;color:#F8F4EF;"><strong>Élément :</strong> ${escapeHtml(p.entityTitle)}</p>
    ${commentBlock}
    ${emailButton(p.actionUrl, 'Ouvrir dans Agency OS')}
  `;

  const text = [
    `Bonjour ${p.recipientName},`,
    '',
    label,
    `Client : ${p.clientName}`,
    `Élément : ${p.entityTitle}`,
    ...(p.comment ? [`Message : ${p.comment}`] : []),
    '',
    p.actionUrl,
  ].join('\n');

  return {
    html: emailLayout({
      title: clientFeedbackSubject(),
      preheader: `${label} — ${p.entityTitle}`,
      innerHtml: inner,
    }),
    text,
  };
}
