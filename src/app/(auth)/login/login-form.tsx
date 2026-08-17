'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { APP_NAME, AGENCY } from '@/lib/constants';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { createClient } from '@/lib/supabase/client';
import { AUTH_SET_PASSWORD_PATH, isPasswordSetupLocation } from '@/lib/auth/password-setup';

const NO_EMPLOYEE_AFTER_SSO_MSG =
  'Compte connecté mais aucun profil employé trouvé.';

const NETWORK_HELP_CLIENT =
  'Impossible de joindre le serveur d’application. Vérifiez que le serveur de dev tourne (npm run dev), ' +
  'votre connexion, Brave Shields, ou désactivez les extensions qui interceptent fetch.';

const NETWORK_HELP_SERVER =
  'Le service d’authentification est injoignable depuis le serveur. Vérifiez NEXT_PUBLIC_SUPABASE_URL, ' +
  'la clé anon, et la connectivité réseau (VPN, pare-feu).';

function isLikelyFetchNetworkFailure(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower === 'failed to fetch' ||
    lower === 'fetch failed' ||
    lower.includes('failed to fetch') ||
    lower.includes('fetch failed') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('socket')
  );
}

function messageFromLoginApiFailure(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message);
    if (isLikelyFetchNetworkFailure(msg)) return NETWORK_HELP_CLIENT;
    return msg;
  }
  return 'Connexion impossible. Réessayez ou contactez un administrateur.';
}

function displayApiError(
  status: number,
  apiMessage: string | undefined,
  apiCode: string | undefined
): string {
  const raw =
    typeof apiMessage === 'string' && apiMessage.length > 0 ? apiMessage : '';

  if (
    apiCode &&
    /^(SUPABASE_|ENV)/.test(apiCode) &&
    raw.length > 0
  ) {
    return raw;
  }

  if (raw && isLikelyFetchNetworkFailure(raw)) {
    return status === 502 ? NETWORK_HELP_SERVER : NETWORK_HELP_CLIENT;
  }
  if (raw) return raw;
  if (status === 401) return 'E-mail ou mot de passe incorrect.';
  if (status === 502) return NETWORK_HELP_SERVER;
  return 'Connexion refusée.';
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';
  const callbackError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Invite / recovery must never stay on the login form (no password yet).
   * Hash tokens are invisible to middleware — intercept them here first.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isPasswordSetupLocation(window.location.search, window.location.hash)) return;
    router.replace(`${AUTH_SET_PASSWORD_PATH}${window.location.search}${window.location.hash}`);
  }, [router]);

  /**
   * Après invitation / lien magique : le hash (#access_token=…) est lu par le client Supabase
   * (detectSessionInUrl), persisté en cookies — on redirige si session valide + employé lié.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window !== 'undefined' && isPasswordSetupLocation(window.location.search, window.location.hash)) {
          return;
        }

        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled || !session?.user) return;

        const { data: employee, error: empError } = await supabase
          .from('employees')
          .select('id, must_change_password')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (empError || !employee) {
          setError(NO_EMPLOYEE_AFTER_SSO_MSG);
          await supabase.auth.signOut();
          return;
        }

        const dest =
          employee.must_change_password === true
            ? '/change-password'
            : next.startsWith('/')
              ? next
              : '/dashboard';
        window.location.assign(dest);
      } catch (e) {
        console.error('[login-form] session depuis URL / invitation', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, next]);

  useEffect(() => {
    if (!callbackError) return;
    setError(callbackError);
  }, [callbackError]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    let navigating = false;

    try {
      const res = await fetch('/api/auth/login', {
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
        error?: string;
        ok?: boolean;
        success?: boolean;
        mustChangePassword?: boolean;
        code?: string;
        missing?: string[];
      } = {};
      try {
        data = (await res.json()) as {
          error?: string;
          ok?: boolean;
          success?: boolean;
          mustChangePassword?: boolean;
          code?: string;
          missing?: string[];
        };
      } catch (parseErr) {
        console.error('[login-form] response.json() failed:', parseErr);
        setError(
          `Réponse invalide du serveur (HTTP ${res.status}). Consultez le terminal Next.js.`
        );
        return;
      }

      if (!res.ok) {
        if (Array.isArray(data.missing) && data.missing.length > 0 && data.error) {
          setError(`${data.error} (${data.missing.join(', ')})`);
          return;
        }
        setError(displayApiError(res.status, data.error, data.code));
        return;
      }

      if (!data.ok && !data.success) {
        setError('Réponse de connexion inattendue. Réessayez.');
        return;
      }

      const dest =
        data.mustChangePassword === true
          ? '/change-password'
          : next.startsWith('/')
            ? next
            : '/dashboard';
      window.location.assign(dest);
      navigating = true;
      return;
    } catch (err) {
      console.error('[login-form] fetch failed (full error):', err);
      if (err instanceof Error) {
        console.error('[login-form] error name:', err.name);
        console.error('[login-form] error message:', err.message);
        if (err.stack) console.error('[login-form] stack:', err.stack);
        if (err.cause) console.error('[login-form] cause:', err.cause);
      }
      setError(messageFromLoginApiFailure(err));
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
            {APP_NAME}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connexion réservée à l&apos;équipe
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card/95 p-6 shadow-supra-glow backdrop-blur-sm sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                placeholder="vous@exemple.com"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Mot de passe
              </label>
              <input
                id="password"
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
              {loading ? (
                'Connexion…'
              ) : (
                <>
                  Connexion
                  <svg
                    className="inline-block h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                  >
                    <path
                      d="M3 8h10M9 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {AGENCY.name} — usage interne
        </p>
      </div>
    </div>
  );
}
