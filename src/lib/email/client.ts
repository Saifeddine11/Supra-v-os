import 'server-only';

import { Resend } from 'resend';

let resend: Resend | null | undefined;

export function getResendClient(): Resend | null {
  if (resend !== undefined) return resend;
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    resend = null;
    return null;
  }
  resend = new Resend(key);
  return resend;
}

export function getEmailFrom(): string | null {
  const from = process.env.EMAIL_FROM?.trim();
  return from || null;
}

export function isEmailConfigured(): boolean {
  return Boolean(getResendClient() && getEmailFrom());
}
