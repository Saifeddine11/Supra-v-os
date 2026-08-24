'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { APP_NAME, AGENCY } from '@/lib/constants';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { AUTH_SET_PASSWORD_PATH, isPasswordSetupLocation } from '@/lib/auth/password-setup';
import {
  CLIENT_AUTH_ERRORS,
  CLIENT_HOME_PATH,
  displayClientLoginError,
  safeClientNextPath,
} from '@/lib/clients/auth-errors';

function isLikelyFetchNetworkFailure(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower === 'failed to fetch' ||
    lower === 'fetch failed' ||
    lower.includes('failed to fetch') ||
    lower.includes('fetch failed') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed')
  );
}

export function ClientLoginForm({ initialError }: { initialError: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeClientNextPath(searchParams.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isPasswordSetupLocation(window.location.search, window.location.hash)) return;
    router.replace(`${AUTH_SET_PASSWORD_PATH}${window.location.search}${window.location.hash}`);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    let navigating = false;

    try {
      const res = await fetch('/api/auth/client-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      let data: {
        ok?: boolean;
        mustChangePassword?: boolean;
        error?: string;
        code?: string;
      } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        data = {};
      }

      if (!res.ok) {
        setError(
          displayClientLoginError({
            status: res.status,
            message: data.error,
            code: data.code,
          }),
        );
        return;
      }

      if (!data.ok) {
        setError(CLIENT_AUTH_ERRORS.unavailable);
        return;
      }

      const dest = data.mustChangePassword === true ? AUTH_SET_PASSWORD_PATH : next || CLIENT_HOME_PATH;
      window.location.assign(dest);
      navigating = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        isLikelyFetchNetworkFailure(msg)
          ? CLIENT_AUTH_ERRORS.unavailable
          : CLIENT_AUTH_ERRORS.unavailable,
      );
    } finally {
      if (!navigating) setLoading(false);
    }
  }

  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-4 py-12 sm:px-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[400px]">
        <div className="mb-10 text-center">
          <p className="font-serif text-2xl font-normal tracking-tight text-supra-gradient sm:text-[1.65rem]">
            {AGENCY.name}
          </p>
          <h1 className="mt-3 text-balance font-sans text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Espace client
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connectez-vous pour suivre vos projets et vos livrables.
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card/95 p-6 shadow-supra-glow backdrop-blur-sm sm:p-8">
          <form onSubmit={(ev) => void handleSubmit(ev)} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="client-email" className="text-sm font-medium text-foreground">
                E-mail
              </label>
              <input
                id="client-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                placeholder="vous@entreprise.com"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="client-password" className="text-sm font-medium text-foreground">
                Mot de passe
              </label>
              <input
                id="client-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="group inline-flex h-12 min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[#FF3D0A] px-6 text-sm font-semibold tracking-tight text-white shadow-[0_14px_36px_-10px_rgba(255,61,10,0.45)] transition-all duration-200 hover:bg-[#E63509] hover:shadow-[0_18px_44px_-10px_rgba(255,61,10,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A2A] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-[rgba(255,61,10,0.45)] disabled:text-white disabled:opacity-70 disabled:shadow-none"
            >
              {loading ? 'Connexion…' : 'Connexion'}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Collaborateur {AGENCY.name} ?{' '}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Connexion équipe
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {AGENCY.name}
        </p>
        <p className="sr-only">{APP_NAME}</p>
      </div>
    </div>
  );
}
