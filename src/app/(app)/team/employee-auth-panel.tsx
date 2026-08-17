'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createAuthUserForEmployeeAction,
  inviteEmployeeAuthAction,
  sendEmployeePasswordResetAction,
} from './employee-auth-actions';
import {
  AUTH_EMAIL_RATE_LIMIT_USER_MESSAGE,
  isAuthEmailRateLimitError,
} from '@/lib/employees/auth-email-errors';

type TempAccountSuccess = {
  message: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
};

type LinkedExistingInfo = {
  message: string;
  email: string;
};

type TempModalView = 'confirm' | 'success' | 'linked';

export function EmployeeAuthPanel({
  employeeId,
  fullName,
  email,
  userId,
}: {
  employeeId: string;
  fullName: string;
  email: string;
  userId: string | null;
}) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [tempOpen, setTempOpen] = useState(false);
  const [tempView, setTempView] = useState<TempModalView>('confirm');
  const [tempModalError, setTempModalError] = useState<string | null>(null);
  const [tempSuccess, setTempSuccess] = useState<TempAccountSuccess | null>(null);
  const [linkedInfo, setLinkedInfo] = useState<LinkedExistingInfo | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const hasEmail = Boolean(email?.trim());
  const creating = pending === 'create';

  async function runInvite() {
    setErr(null);
    setOk(null);
    setPending('invite');
    try {
      const res = await inviteEmployeeAuthAction(employeeId);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setOk(
        res.data?.mode === 'linked_existing'
          ? 'Compte Auth lié (utilisateur déjà présent dans Supabase).'
          : 'Invitation envoyée. Le lien ouvre la définition du mot de passe.',
      );
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function runReset() {
    setErr(null);
    setOk(null);
    setPending('reset');
    try {
      const res = await sendEmployeePasswordResetAction(employeeId);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setOk('E-mail de réinitialisation du mot de passe envoyé.');
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  function openTempModal() {
    setErr(null);
    setTempModalError(null);
    setTempSuccess(null);
    setLinkedInfo(null);
    setPasswordCopied(false);
    setTempView('confirm');
    setTempOpen(true);
  }

  function closeTempModal() {
    if (creating) return;
    const shouldRefresh = tempView === 'success' || tempView === 'linked';
    setTempOpen(false);
    setTempView('confirm');
    setTempModalError(null);
    setTempSuccess(null);
    setLinkedInfo(null);
    setPasswordCopied(false);
    if (shouldRefresh) router.refresh();
  }

  async function runCreateTemp() {
    setTempModalError(null);
    setPasswordCopied(false);
    setPending('create');
    try {
      const res = await createAuthUserForEmployeeAction(employeeId);
      if (!res.ok) {
        setTempModalError(res.error);
        return;
      }
      const data = res.data;
      if (!data) {
        setTempModalError('Réponse serveur inattendue.');
        return;
      }
      if (data.mode === 'linked_existing') {
        setLinkedInfo({ message: data.message, email: data.email });
        setTempView('linked');
        return;
      }
      setTempSuccess({
        message: data.message,
        email: data.email,
        temporaryPassword: data.temporaryPassword,
        loginUrl: data.loginUrl,
      });
      setTempView('success');
    } catch {
      setTempModalError('Création du mot de passe impossible. Réessayez.');
    } finally {
      setPending(null);
    }
  }

  async function copyTemporaryPassword(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setPasswordCopied(true);
    } catch {
      setPasswordCopied(false);
      setTempModalError('Impossible de copier. Sélectionnez le mot de passe manuellement.');
    }
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Connexion Supabase</span>
        {userId ? (
          <Badge variant="outline" className="border-emerald-500/40 font-normal text-emerald-800 dark:text-emerald-300">
            Auth lié
          </Badge>
        ) : (
          <Badge variant="outline" className="border-amber-500/50 font-normal text-amber-800 dark:text-amber-200">
            Auth non lié
          </Badge>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        L’invitation par e-mail est le flux recommandé. Les invitations et réinitialisations utilisent l’e-mail de la
        fiche et redirigent vers{' '}
        <span className="font-mono text-[10px] text-foreground/80">/auth/set-password</span>.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
        {!userId ? (
          <>
            <Button
              type="button"
              variant="primary"
              className="min-h-11 rounded-full"
              disabled={!hasEmail || Boolean(pending)}
              onClick={() => void runInvite()}
            >
              {pending === 'invite' ? 'Envoi…' : 'Envoyer invitation'}
            </Button>
            <div className="flex min-w-0 flex-col gap-1">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-full border-amber-500/45 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200"
                disabled={!hasEmail || Boolean(pending)}
                onClick={openTempModal}
              >
                Créer accès (mot de passe temporaire)
              </Button>
              <p className="max-w-sm text-[11px] leading-relaxed text-muted-foreground">
                À utiliser uniquement si l’employé ne reçoit pas l’e-mail d’invitation.
              </p>
            </div>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-full"
            disabled={!hasEmail || Boolean(pending)}
            onClick={() => void runReset()}
          >
            {pending === 'reset' ? 'Envoi…' : 'Envoyer réinitialisation mot de passe'}
          </Button>
        )}
      </div>

      {!hasEmail ? (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
          Cet employé n’a pas d’e-mail. Ajoutez un e-mail avant de créer le compte.
        </p>
      ) : null}
      {err ? (
        <div
          className={
            isAuthEmailRateLimitError(err) || err === AUTH_EMAIL_RATE_LIMIT_USER_MESSAGE
              ? 'mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100'
              : 'mt-3 text-sm text-destructive'
          }
          role="alert"
        >
          {err}
          {isAuthEmailRateLimitError(err) || err === AUTH_EMAIL_RATE_LIMIT_USER_MESSAGE ? (
            <p className="mt-2 text-xs opacity-90">
              Configurez un SMTP personnalisé (ex. Resend) dans Supabase → Authentication → SMTP Settings, ou utilisez
              « Créer accès (mot de passe temporaire) » ci-dessus.
            </p>
          ) : null}
        </div>
      ) : null}
      {ok ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{ok}</p> : null}

      <Dialog
        open={tempOpen}
        onOpenChange={(open) => {
          if (!open) closeTempModal();
        }}
      >
        <DialogContent
          showCloseButton={!creating}
          overlayClassName="bg-black/40"
          className="max-w-md sm:max-w-md"
          onPointerDownOutside={(event) => {
            if (creating) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (creating) event.preventDefault();
          }}
        >
          {tempView === 'confirm' ? (
            <>
              <DialogHeader>
                <DialogTitle>Créer un mot de passe temporaire ?</DialogTitle>
                <DialogDescription>
                  Cette action crée un mot de passe provisoire pour cet employé. Il sera affiché une seule fois et devra
                  être changé lors de la première connexion.
                </DialogDescription>
              </DialogHeader>
              {fullName || email ? (
                <p className="text-sm text-foreground">
                  <span className="font-medium">{fullName}</span>
                  {email ? (
                    <>
                      <span className="text-muted-foreground"> · </span>
                      <span className="break-all text-muted-foreground">{email}</span>
                    </>
                  ) : null}
                </p>
              ) : null}
              {tempModalError ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                  {tempModalError}
                </p>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="ghost" className="rounded-full" disabled={creating} onClick={closeTempModal}>
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="rounded-full"
                  disabled={creating}
                  onClick={() => void runCreateTemp()}
                >
                  {creating ? 'Création…' : 'Créer le mot de passe'}
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {tempView === 'success' && tempSuccess ? (
            <>
              <DialogHeader>
                <DialogTitle>Mot de passe temporaire créé</DialogTitle>
                <DialogDescription>
                  Transmettez ces informations au collaborateur par un canal sécurisé, puis fermez cette fenêtre.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">E-mail</p>
                  <p className="break-all rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm font-medium">
                    {tempSuccess.email}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Mot de passe temporaire
                  </p>
                  <p className="select-all rounded-xl border border-border bg-muted/50 px-3 py-3 font-mono text-sm tracking-wide text-foreground">
                    {tempSuccess.temporaryPassword}
                  </p>
                </div>
                <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                  Ce mot de passe est affiché une seule fois. Copiez-le maintenant.
                </p>
                {tempModalError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {tempModalError}
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => void copyTemporaryPassword(tempSuccess.temporaryPassword)}
                >
                  {passwordCopied ? 'Copié' : 'Copier'}
                </Button>
                <Button type="button" variant="primary" className="rounded-full" onClick={closeTempModal}>
                  Fermer
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {tempView === 'linked' && linkedInfo ? (
            <>
              <DialogHeader>
                <DialogTitle>Compte Auth existant</DialogTitle>
                <DialogDescription className="text-left text-foreground/85">{linkedInfo.message}</DialogDescription>
              </DialogHeader>
              <p className="break-all text-sm text-muted-foreground">
                <span className="font-medium text-foreground">E-mail : </span>
                {linkedInfo.email}
              </p>
              <DialogFooter>
                <Button type="button" variant="primary" className="rounded-full" onClick={closeTempModal}>
                  Fermer
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
