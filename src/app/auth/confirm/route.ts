import { type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAuthRedirectClient } from '@/lib/supabase/auth-route';
import { ensureEmployeeLinkedByEmail } from '@/lib/employees/auth-provision';
import { AUTH_SET_PASSWORD_PATH } from '@/lib/auth/password-setup';

const OTP_TYPES = new Set<EmailOtpType>([
  'invite',
  'recovery',
  'signup',
  'email',
]);

function asOtpType(raw: string | null): EmailOtpType | null {
  if (!raw || !OTP_TYPES.has(raw as EmailOtpType)) return null;
  return raw as EmailOtpType;
}

function logDevVerifyError(type: EmailOtpType, error: unknown) {
  if (process.env.NODE_ENV === 'production') return;
  const details =
    error && typeof error === 'object'
      ? {
          type,
          errorCode: 'code' in error ? String(error.code) : undefined,
          status: 'status' in error ? Number(error.status) : undefined,
          message: 'message' in error ? String(error.message) : undefined,
        }
      : { type, message: String(error) };
  console.error('[auth-confirm] verifyOtp failed', details);
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = asOtpType(request.nextUrl.searchParams.get('type'));
  const { supabase, missingConfig, redirectTo } = createAuthRedirectClient(request);

  if (missingConfig || !supabase) {
    return redirectTo('/login?error=invalid_link');
  }

  if (!tokenHash || !type) {
    return redirectTo(`${AUTH_SET_PASSWORD_PATH}?error=invalid_link`);
  }

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    logDevVerifyError(type, error);
    return redirectTo(`${AUTH_SET_PASSWORD_PATH}?error=invalid_or_expired_link`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      const admin = createAdminClient();
      await ensureEmployeeLinkedByEmail(admin, user.id, user.email);
    } catch {
      // Liaison best-effort — la page set-password peut encore finaliser.
    }
  }

  return redirectTo(AUTH_SET_PASSWORD_PATH);
}
