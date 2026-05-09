/**
 * Shared transactional email shell — inline styles for client compatibility.
 * Brand: Supra v. — deep black, off-white text, #FF3D0A accent.
 */

const ACCENT = '#FF3D0A';
const BG = '#080706';
const CARD = '#1A0703';
const TEXT = '#F8F4EF';
const MUTED = '#A8A19A';
const BORDER = 'rgba(248,244,239,0.12)';

export function emailLayout(opts: { title: string; preheader?: string; innerHtml: string }): string {
  const pre = opts.preheader
    ? `<span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(opts.preheader)}</span>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};font-family:Georgia,'Times New Roman',serif;">
  ${pre}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;border:1px solid ${BORDER};border-radius:12px;background-color:${CARD};overflow:hidden;">
          <tr>
            <td style="height:3px;padding:0;line-height:3px;font-size:3px;background-color:${ACCENT};">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 28px 20px 28px;border-bottom:1px solid ${BORDER};">
              <p style="margin:0;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:${TEXT};">Supra v.</p>
              <p style="margin:6px 0 0 0;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};">Agency OS</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;color:${TEXT};font-size:15px;line-height:1.65;">
              ${opts.innerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px 28px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};">
                Ce message est envoyé par Supra v. Agency OS. Répondez à votre interlocuteur habituel pour toute question opérationnelle.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
    <tr>
      <td style="border-radius:999px;background-color:${ACCENT};">
        <a href="${escapeAttr(href)}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#F8F4EF;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
