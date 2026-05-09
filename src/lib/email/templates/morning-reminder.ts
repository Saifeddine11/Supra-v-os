import { emailButton, emailLayout, escapeHtml } from '@/lib/email/layout';

export type MorningReminderProps = {
  recipientName: string;
  date: string;
  tasksToday: string[];
  urgentTasks: string[];
  overdueTasks: string[];
  dashboardUrl: string;
};

export function morningReminderSubject() {
  return 'Rappel matinal — Supra v. Agency OS';
}

export function renderMorningReminderEmail(p: MorningReminderProps): { html: string; text: string } {
  const linesToday = p.tasksToday.length
    ? `<ul style="margin:12px 0;padding-left:20px;color:#F8F4EF;">${p.tasksToday.map((t) => `<li style="margin:6px 0;">${escapeHtml(t)}</li>`).join('')}</ul>`
    : `<p style="color:#A8A19A;margin:12px 0;">Aucune tâche à échéance précise aujourd'hui dans ce récapitulatif.</p>`;

  const linesUrgent = p.urgentTasks.length
    ? `<p style="margin:20px 0 8px 0;font-size:13px;font-weight:600;color:#FF3D0A;text-transform:uppercase;letter-spacing:0.08em;">Urgent</p><ul style="margin:0;padding-left:20px;">${p.urgentTasks.map((t) => `<li style="margin:6px 0;color:#F8F4EF;">${escapeHtml(t)}</li>`).join('')}</ul>`
    : '';

  const linesOverdue = p.overdueTasks.length
    ? `<p style="margin:20px 0 8px 0;font-size:13px;font-weight:600;color:#E05252;">En retard</p><ul style="margin:0;padding-left:20px;">${p.overdueTasks.map((t) => `<li style="margin:6px 0;color:#F8F4EF;">${escapeHtml(t)}</li>`).join('')}</ul>`
    : '';

  const inner = `
    <p style="margin:0 0 8px 0;color:#F8F4EF;">Bonjour ${escapeHtml(p.recipientName)},</p>
    <p style="margin:0 0 20px 0;color:#A8A19A;font-size:14px;">${escapeHtml(p.date)}</p>
    <p style="margin:0 0 8px 0;font-weight:600;color:#F8F4EF;">Priorités du jour</p>
    ${linesToday}
    ${linesUrgent}
    ${linesOverdue}
    <p style="margin:20px 0 0 0;color:#A8A19A;font-size:14px;">Pensez à mettre à jour vos statuts avant la fin de journée pour conserver un pilotage fiable.</p>
    ${emailButton(p.dashboardUrl, 'Ouvrir le dashboard')}
  `;

  const text = [
    `Bonjour ${p.recipientName},`,
    '',
    p.date,
    '',
    'Priorités du jour :',
    ...(p.tasksToday.length ? p.tasksToday.map((t) => `• ${t}`) : ['• (aucune dans ce récapitulatif)']),
    '',
    ...(p.urgentTasks.length ? ['Urgent :', ...p.urgentTasks.map((t) => `• ${t}`), ''] : []),
    ...(p.overdueTasks.length ? ['En retard :', ...p.overdueTasks.map((t) => `• ${t}`), ''] : []),
    'Ouvrir le dashboard :',
    p.dashboardUrl,
  ].join('\n');

  return {
    html: emailLayout({
      title: morningReminderSubject(),
      preheader: `Rappel des tâches pour ${p.date}`,
      innerHtml: inner,
    }),
    text,
  };
}
