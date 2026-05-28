/** Message UI admin lorsque Supabase Auth bloque l’envoi (quota SMTP intégré). */
export const AUTH_EMAIL_RATE_LIMIT_USER_MESSAGE =
  'Limite d’envoi d’e-mails atteinte. Réessayez plus tard ou utilisez la création de mot de passe temporaire.';

export function isAuthEmailRateLimitError(message: string): boolean {
  return /rate limit|too many requests|email.*limit|over_email_send_rate/i.test(message);
}

export function mapSupabaseAuthEmailError(message: string): string {
  const m = message.trim();
  if (isAuthEmailRateLimitError(m)) return AUTH_EMAIL_RATE_LIMIT_USER_MESSAGE;
  if (/already|registered|exists|duplicate/i.test(m)) {
    return 'Un compte existe peut-être déjà pour cet e-mail.';
  }
  if (/invalid.*redirect|redirect.*not allowed|redirect_to/i.test(m)) {
    return (
      'URL de redirection refusée par Supabase. Vérifiez Authentication → URL Configuration ' +
      '(Site URL et Redirect URLs) et que NEXT_PUBLIC_APP_URL correspond à l’URL de production.'
    );
  }
  if (/smtp|email.*send|mail delivery/i.test(m)) {
    return (
      'Envoi d’e-mail impossible côté Supabase. Configurez un SMTP personnalisé (ex. Resend) dans ' +
      'Authentication → SMTP Settings du projet Supabase.'
    );
  }
  return m || 'Une erreur est survenue.';
}
