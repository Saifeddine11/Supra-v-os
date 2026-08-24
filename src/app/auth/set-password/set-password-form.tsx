'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import type { EmailOtpType } from '@supabase/supabase-js';
import { APP_NAME, AGENCY } from '@/lib/constants';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { PASSWORD_SETUP_MIN_LENGTH } from '@/lib/auth/password-setup';
import { finalizePasswordSetupAction } from './actions';

const EXPIRED_MESSAGE =
  'Ce lien est invalide ou expiré. Demandez une nouvelle invitation à l’administrateur.';

const OTP_TYPES = new Set<EmailOtpType>([
  'invite',
  'recovery',
  'signup',
  'magiclink',
  'email_change',
  'email',
]);

type Status = 'loading' | 'ready' | 'expired';

export function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkError = searchParams.get('error');

  const [status, setStatus] = useState<Status>(linkError ? 'expired' : 'loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (linkError) return;

    let cancelled = false;
    let settled = false;

    const finish = (ok: boolean) => {
      if (cancelled || settled) return;
      settled = true;
      setStatus(ok ? 'ready' : 'expired');
    };

    let supabase;
    try {
      supabase = createClient();
    } catch (e) {
      console.error('[set-password] supabase client', e);
      finish(false);
      return;
    }

    const client = supabase;

    async function establishSession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const tokenHash = url.searchParams.get('token_hash');
      const rawType = url.searchParams.get('type');
      const type = rawType && OTP_TYPES.has(rawType as EmailOtpType) ? (rawType as EmailOtpType) : null;

      try {
        if (code) {
          await client.auth.exchangeCodeForSession(code);
          url.searchParams.delete('code');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        } else if (tokenHash && type) {
          await client.auth.verifyOtp({ token_hash: tokenHash, type });
          url.searchParams.delete('token_hash');
          url.searchParams.delete('type');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        }

        const {
          data: { session },
        } = await client.auth.getSession();
        if (session) {
          finish(true);
        }
      } catch (e) {
        console.error('[set-password] session bootstrap', e);
      }
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (
        event === 'SIGNED_IN' ||
        event === 'PASSWORD_RECOVERY' ||
        event === 'INITIAL_SESSION' ||
        event === 'TOKEN_REFRESHED'
      ) {
        finish(true);
      }
    });

    void establishSession();

    const timeoutId = window.setTimeout(() => {
      void client.auth.getSession().then(({ data: { session } }) => {
        finish(Boolean(session));
      });
    }, 5000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(timeoutId);
    };
  }, [linkError]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const pw = password.trim();
    const cf = confirm.trim();
    if (pw.length < PASSWORD_SETUP_MIN_LENGTH) {
      setErr(`Le mot de passe doit contenir au moins ${PASSWORD_SETUP_MIN_LENGTH} caractères.`);
      return;
    }
    if (pw !== cf) {
      setErr('Les mots de passe ne correspondent pas.');
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        setErr(error.message);
        return;
      }

      const finalized = await finalizePasswordSetupAction();
      if (!finalized.ok) {
        console.error('[set-password] finalize', finalized.error);
      }

      toast.success('Mot de passe créé avec succès. Redirection vers votre espace.');
      const dest = finalized.ok ? finalized.redirectTo : '/dashboard';
      router.replace(dest);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Impossible d’enregistrer le mot de passe.');
    } finally {
      setPending(false);
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
        </div>

        <div className="rounded-2xl border border-border/80 bg-card/95 p-6 shadow-supra-glow backdrop-blur-sm sm:p-8">
          {status === 'loading' ? (
            <p className="text-center text-sm text-muted-foreground">Vérification du lien…</p>
          ) : null}

          {status === 'expired' ? (
            <div className="space-y-5 text-center">
              <h2 className="font-sans text-xl font-semibold tracking-tight text-foreground">
                Lien invalide
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground" role="alert">
                {EXPIRED_MESSAGE}
              </p>
              <Button asChild variant="primary" className="w-full rounded-full">
                <Link href="/login">Retour à la connexion équipe</Link>
              </Button>
              <Button asChild variant="outline" className="w-full rounded-full">
                <Link href="/client/login">Espace client</Link>
              </Button>
            </div>
          ) : null}

          {status === 'ready' ? (
            <form onSubmit={(ev) => void onSubmit(ev)} className="space-y-5">
              <div className="text-center">
                <h2 className="font-sans text-xl font-semibold tracking-tight text-foreground">
                  Créer votre mot de passe
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Votre compte a été créé. Définissez un mot de passe sécurisé pour accéder à Supra v OS.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nouveau mot de passe</Label>
                <Input
                  id="new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_SETUP_MIN_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                  placeholder={`Au moins ${PASSWORD_SETUP_MIN_LENGTH} caractères`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                <Input
                  id="confirm-password"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_SETUP_MIN_LENGTH}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-11"
                />
              </div>
              {err ? (
                <p className="text-sm text-destructive" role="alert">
                  {err}
                </p>
              ) : null}
              <Button type="submit" variant="primary" className="w-full rounded-full" disabled={pending}>
                {pending ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
