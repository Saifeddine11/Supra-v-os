import 'server-only';

import { randomBytes } from 'crypto';
import { createAdminClient, type ServiceRoleClient } from '@/lib/supabase/admin';

/**
 * Cible après clic sur le lien d’invitation / reset (doit figurer dans Redirect URLs Supabase).
 * Production : définir NEXT_PUBLIC_APP_URL=https://app.suprav3.com (sans slash final).
 */
export function getAuthLoginRedirectUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/login`;
}

/** Page de connexion publique (même base que les redirections Auth). */
export function getPublicLoginPageUrl(): string {
  return getAuthLoginRedirectUrl();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Parcourt les pages listUsers (plafonné) pour retrouver un utilisateur Auth par e-mail. */
export async function findAuthUserIdByEmail(
  admin: ServiceRoleClient,
  email: string,
): Promise<string | null> {
  const want = normalizeEmail(email);
  let page = 1;
  const perPage = 200;
  const maxPages = 40;

  for (; page <= maxPages; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const found = data.users.find((u) => normalizeEmail(u.email ?? '') === want);
    if (found) return found.id;
    if (data.users.length < perPage) return null;
  }
  return null;
}

export async function assertEmployeeUserIdAvailable(
  admin: ServiceRoleClient,
  employeeId: string,
  authUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: other } = await admin
    .from('employees')
    .select('id, full_name')
    .eq('user_id', authUserId)
    .neq('id', employeeId)
    .maybeSingle();
  if (other) {
    return {
      ok: false,
      error: `Ce compte Auth est déjà lié à un autre collaborateur (${other.full_name}).`,
    };
  }
  return { ok: true };
}

export async function linkEmployeeToAuthUser(
  admin: ServiceRoleClient,
  employeeId: string,
  authUserId: string,
  options?: { mustChangePassword?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await assertEmployeeUserIdAvailable(admin, employeeId, authUserId);
  if (!guard.ok) return guard;

  const patch: Record<string, unknown> = {
    user_id: authUserId,
    updated_at: new Date().toISOString(),
  };
  if (options?.mustChangePassword === true) {
    patch.must_change_password = true;
  }

  const { error } = await admin.from('employees').update(patch).eq('id', employeeId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

function mapAuthError(msg: string): string {
  const m = msg.trim();
  if (/rate limit|too many/i.test(m)) return 'Trop de tentatives. Réessayez plus tard.';
  if (/already|registered|exists|duplicate/i.test(m))
    return 'Un compte existe peut-être déjà pour cet e-mail.';
  if (/invalid.*redirect|redirect.*not allowed|redirect_to/i.test(m))
    return (
      'URL de redirection refusée par Supabase. Vérifiez Authentication → URL Configuration ' +
      '(Site URL et Redirect URLs) et que NEXT_PUBLIC_APP_URL correspond à l’URL de production.'
    );
  if (/smtp|email.*send|mail delivery/i.test(m))
    return (
      'Envoi d’e-mail impossible côté Supabase. Vérifiez SMTP / fournisseur d’e-mail dans le dashboard du projet.'
    );
  return m || 'Une erreur est survenue.';
}

export type InviteEmployeeAuthResult =
  | { ok: true; mode: 'invited' }
  | { ok: true; mode: 'linked_existing' }
  | { ok: false; error: string };

/**
 * inviteUserByEmail (admin) puis liaison `employees.user_id`.
 * Si l’e-mail existe déjà dans Auth, on tente de lier le `user.id` existant.
 */
export async function inviteEmployeeAuth(
  employeeId: string,
  email: string,
): Promise<InviteEmployeeAuthResult> {
  const admin = createAdminClient();
  const em = normalizeEmail(email);
  if (!em) return { ok: false, error: 'Cet employé n’a pas d’e-mail.' };

  const { data: row } = await admin.from('employees').select('user_id').eq('id', employeeId).maybeSingle();
  if (row?.user_id) return { ok: false, error: 'Compte Auth déjà lié.' };

  const redirectTo = getAuthLoginRedirectUrl();

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(em, {
    redirectTo,
    data: { employee_id: employeeId },
  });

  if (!inviteErr && invited?.user?.id) {
    const link = await linkEmployeeToAuthUser(admin, employeeId, invited.user.id, {});
    if (!link.ok) {
      await admin.auth.admin.deleteUser(invited.user.id).catch(() => {});
      return { ok: false, error: link.error };
    }
    return { ok: true, mode: 'invited' };
  }

  const inviteMsg = inviteErr?.message ?? '';
  const maybeExists = /already|registered|exists|duplicate/i.test(inviteMsg) || inviteErr?.status === 422;

  if (maybeExists || inviteErr) {
    const existingId = await findAuthUserIdByEmail(admin, em);
    if (existingId) {
      const link = await linkEmployeeToAuthUser(admin, employeeId, existingId, {});
      if (!link.ok) {
        if (!maybeExists) return { ok: false, error: mapAuthError(inviteMsg) };
        return { ok: false, error: link.error };
      }
      return { ok: true, mode: 'linked_existing' };
    }
  }

  return { ok: false, error: mapAuthError(inviteMsg) || 'Impossible d’envoyer l’invitation.' };
}

export type CreateTempAuthResult =
  | { ok: true; mode: 'temp_password'; temporaryPassword: string; userId: string }
  | { ok: true; mode: 'linked_existing'; userId: string }
  | { ok: false; error: string };

/**
 * Crée un utilisateur Auth avec mot de passe temporaire (affiché une seule fois côté UI).
 * Ne jamais journaliser le mot de passe.
 */
export async function createEmployeeAuthWithTempPassword(
  employeeId: string,
  email: string,
): Promise<CreateTempAuthResult> {
  const admin = createAdminClient();
  const em = normalizeEmail(email);
  if (!em) {
    return {
      ok: false,
      error: 'Cet employé n’a pas d’e-mail. Ajoutez un e-mail avant de créer le compte.',
    };
  }

  const { data: row } = await admin.from('employees').select('user_id').eq('id', employeeId).maybeSingle();
  if (row?.user_id) return { ok: false, error: 'Compte Auth déjà lié.' };

  const existingId = await findAuthUserIdByEmail(admin, em);
  if (existingId) {
    const link = await linkEmployeeToAuthUser(admin, employeeId, existingId, {});
    if (!link.ok) {
      return {
        ok: false,
        error:
          'Un compte Auth existe déjà pour cet e-mail, mais la liaison au profil a échoué. Utilisez « Envoyer réinitialisation mot de passe » ou contactez un administrateur.',
      };
    }
    return { ok: true, mode: 'linked_existing', userId: existingId };
  }

  const temporaryPassword = randomBytes(18).toString('base64url').slice(0, 22);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: em,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { employee_id: employeeId },
  });

  if (createErr || !created?.user?.id) {
    const msg = createErr?.message ?? '';
    if (/already|exists|registered|duplicate/i.test(msg)) {
      const retryId = await findAuthUserIdByEmail(admin, em);
      if (retryId) {
        const link = await linkEmployeeToAuthUser(admin, employeeId, retryId, {});
        if (link.ok) return { ok: true, mode: 'linked_existing', userId: retryId };
      }
      return {
        ok: false,
        error:
          'Un compte Auth existe déjà pour cet e-mail. Liez le profil via « Envoyer invitation » ou utilisez « Envoyer réinitialisation mot de passe » une fois le compte lié.',
      };
    }
    return { ok: false, error: mapAuthError(msg) || 'Création du compte impossible.' };
  }

  const link = await linkEmployeeToAuthUser(admin, employeeId, created.user.id, {
    mustChangePassword: true,
  });
  if (!link.ok) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return { ok: false, error: link.error };
  }

  return {
    ok: true,
    mode: 'temp_password',
    temporaryPassword,
    userId: created.user.id,
  };
}

export type PasswordResetResult = { ok: true } | { ok: false; error: string };

/** E-mail « mot de passe oublié » — même flux que le client, avec redirect vers /login. */
export async function sendAuthPasswordResetEmail(email: string): Promise<PasswordResetResult> {
  const admin = createAdminClient();
  const em = normalizeEmail(email);
  if (!em) return { ok: false, error: 'Cet employé n’a pas d’e-mail.' };

  const redirectTo = getAuthLoginRedirectUrl();
  const { error } = await admin.auth.resetPasswordForEmail(em, { redirectTo });
  if (error) {
    return { ok: false, error: mapAuthError(error.message) || 'Impossible d’envoyer l’e-mail de réinitialisation.' };
  }
  return { ok: true };
}
