import { emailButton, emailLayout, escapeHtml } from '@/lib/email/layout';

export type EveningSummaryProps = {
  recipientName: string;
  date: string;
  completedTasks: string[];
  remainingTasks: string[];
  overdueTasks: string[];
  tomorrowTasks: string[];
  dashboardUrl: string;
};

export function eveningSummarySubject() {
  return 'Bilan de fin de journée — Supra v. Agency OS';
}

export function renderEveningSummaryEmail(p: EveningSummaryProps): { html: string; text: string } {
  const section = (title: string, items: string[], color = '#F8F4EF') =>
    items.length
      ? `<p style="margin:20px 0 8px 0;font-size:13px;font-weight:600;color:#FF3D0A;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(title)}</p><ul style="margin:0;padding-left:20px;color:${color};">${items.map((t) => `<li style="margin:6px 0;">${escapeHtml(t)}</li>`).join('')}</ul>`
      : '';

  const inner = `
    <p style="margin:0 0 8px 0;color:#F8F4EF;">Bonsoir ${escapeHtml(p.recipientName)},</p>
    <p style="margin:0 0 20px 0;color:#A8A19A;font-size:14px;">${escapeHtml(p.date)}</p>
    ${section("Traité aujourd'hui", p.completedTasks)}
    ${section('Toujours en cours', p.remainingTasks)}
    ${section('En retard', p.overdueTasks, '#E8B4B4')}
    ${section('À traiter demain', p.tomorrowTasks)}
    <p style="margin:24px 0 0 0;color:#A8A19A;font-size:14px;">Merci de maintenir les statuts à jour pour garantir une vision équipe fiable.</p>
    ${emailButton(p.dashboardUrl, 'Ouvrir le dashboard')}
  `;

  const text = [
    `Bonsoir ${p.recipientName},`,
    '',
    p.date,
    '',
    ...(p.completedTasks.length ? ["Traité aujourd'hui :", ...p.completedTasks.map((t) => `• ${t}`), ''] : []),
    ...(p.remainingTasks.length ? ['Toujours en cours :', ...p.remainingTasks.map((t) => `• ${t}`), ''] : []),
    ...(p.overdueTasks.length ? ['En retard :', ...p.overdueTasks.map((t) => `• ${t}`), ''] : []),
    ...(p.tomorrowTasks.length ? ['À traiter demain :', ...p.tomorrowTasks.map((t) => `• ${t}`), ''] : []),
    p.dashboardUrl,
  ].join('\n');

  return {
    html: emailLayout({
      title: eveningSummarySubject(),
      preheader: `Bilan du ${p.date}`,
      innerHtml: inner,
    }),
    text,
  };
}
