import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AUTH_SET_PASSWORD_PATH } from '@/lib/auth/password-setup';
import { getClientAuthState } from '@/lib/clients/session';
import { CLIENT_AUTH_ERRORS, CLIENT_HOME_PATH } from '@/lib/clients/auth-errors';
import { ClientLoginForm } from './client-login-form';

export const metadata: Metadata = {
  title: 'Espace client',
};

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Chargement…</p>
    </div>
  );
}

function initialErrorFromParam(error: string | undefined): string | null {
  if (error === 'disabled') return CLIENT_AUTH_ERRORS.inactive;
  if (error === 'access') return CLIENT_AUTH_ERRORS.genericAccess;
  if (error === 'unavailable') return CLIENT_AUTH_ERRORS.unavailable;
  if (error === 'session') return CLIENT_AUTH_ERRORS.sessionExpired;
  return null;
}

export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const state = await getClientAuthState();
  if (state.kind === 'ok') {
    if (state.ctx.mustChangePassword) {
      redirect(AUTH_SET_PASSWORD_PATH);
    }
    redirect(CLIENT_HOME_PATH);
  }
  if (state.kind === 'inactive') {
    redirect('/api/auth/client-logout?error=disabled');
  }

  const sp = searchParams ? await searchParams : {};
  const initialError = initialErrorFromParam(sp.error);

  return (
    <Suspense fallback={<LoginFallback />}>
      <ClientLoginForm initialError={initialError} />
    </Suspense>
  );
}
