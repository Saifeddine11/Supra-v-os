import { emailButton, emailLayout, escapeHtml } from '@/lib/email/layout';

export type CriticalAlertReminderProps = {
  recipientName: string;
  criticalCount: number;
  summaryLines: string[];
  dashboardUrl: string;
};

export function criticalAlertReminderSubject(count: number) {
  return count > 1
    ? `Rappel critique — ${count} alertes à traiter — Supra v.`
    : 'Rappel critique — action requise — Supra v.';
}

export function renderCriticalAlertReminderEmail(p: CriticalAlertReminderProps): { html: string; text: string } {
  const linesHtml = p.summaryLines
    .slice(0, 8)
    .map((l) => `<li style="margin:6px 0;color:#F8F4EF;">${escapeHtml(l)}</li>`)
    .join('');

  const inner = `
    <p style="margin:0 0 8px 0;color:#F8F4EF;">Bonjour ${escapeHtml(p.recipientName)},</p>
    <p style="margin:0 0 16px 0;color:#FF6A2A;font-size:15px;font-weight:600;">
      ${p.criticalCount} alerte(s) critique(s) toujours actives — rappel obligatoire toutes les 2 heures tant que le problème n’est pas résolu.
    </p>
    <p style="margin:0 0 12px 0;color:#A8A19A;font-size:13px;">
      Lire une notification ne suffit pas : la tâche, la vidéo ou la facture doit être traitée dans l’app.
    </p>
    <ul style="margin:0;padding-left:20px;">${linesHtml}</ul>
    ${emailButton(p.dashboardUrl, 'Ouvrir le tableau de bord')}
  `;

  const text = [
    `Bonjour ${p.recipientName},`,
    '',
    `${p.criticalCount} alerte(s) critique(s) actives (rappel 2h).`,
    '',
    ...p.summaryLines.slice(0, 8),
    '',
    p.dashboardUrl,
  ].join('\n');

  return {
    html: emailLayout({ title: 'Rappel critique', innerHtml: inner }),
    text,
  };
}
