'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  createAuthUserForEmployeeAction,
  inviteEmployeeAuthAction,
  sendEmployeePasswordResetAction,
} from './employee-auth-actions';

type TempAccountSuccess = {
  message: string;
  email: string;
  temporaryPassword: string;
};

type LinkedExistingInfo = {
  message: string;
  email: string;
};

export function EmployeeAuthPanel({
  employeeId,
  email,
  userId,
}: {
  employeeId: string;
  email: string;
  userId: string | null;
}) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmTemp, setConfirmTemp] = useState(false);
  const [tempSuccess, setTempSuccess] = useState<TempAccountSuccess | null>(null);
  const [linkedInfo, setLinkedInfo] = useState<LinkedExistingInfo | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const hasEmail = Boolean(email?.trim());

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
          : 'Invitation envoyée. Compte Auth lié.',
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

  async function runCreateTemp() {
    setErr(null);
    setPasswordCopied(false);
    setPending('create');
    try {
      const res = await createAuthUserForEmployeeAction(employeeId);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      const data = res.data;
      if (!data) {
        setErr('Réponse serveur inattendue.');
        return;
      }
      setConfirmTemp(false);
      if (data.mode === 'linked_existing') {
        setLinkedInfo({ message: data.message, email: data.email });
        return;
      }
      setTempSuccess({
        message: data.message,
        email: data.email,
        temporaryPassword: data.temporaryPassword,
      });
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
    }
  }

  function closeTempSuccess(open: boolean) {
    if (!open) {
      setTempSuccess(null);
      setPasswordCopied(false);
      router.refresh();
    }
  }

  function closeLinkedInfo(open: boolean) {
    if (!open) {
      setLinkedInfo(null);
      router.refresh();
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
        Les invitations et réinitialisations utilisent l’e-mail de la fiche et le domaine{' '}
        <span className="font-mono text-[10px] text-foreground/80">NEXT_PUBLIC_APP_URL</span> pour la redirection vers
        la page de connexion.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-full"
              disabled={!hasEmail || Boolean(pending)}
              onClick={() => {
                setErr(null);
                setConfirmTemp(true);
              }}
            >
              Créer accès (mot de passe temporaire)
            </Button>
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
      {err ? <p className="mt-3 text-sm text-destructive">{err}</p> : null}
      {ok ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{ok}</p> : null}

      <AlertDialog open={confirmTemp} onOpenChange={setConfirmTemp}>
        <AlertDialogContent className="z-[102]">
          <AlertDialogHeader>
            <AlertDialogTitle>Mot de passe temporaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              Un compte Supabase Auth sera créé avec un mot de passe généré, affiché une seule fois. Demandez au
              collaborateur de le changer après la première connexion. Préférez l’invitation par e-mail lorsque SMTP
              Supabase est correctement configuré.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending === 'create'}>Annuler</AlertDialogCancel>
            <Button
              type="button"
              variant="primary"
              className="rounded-full"
              disabled={pending === 'create'}
              onClick={() => void runCreateTemp()}
            >
              {pending === 'create' ? 'Création…' : 'Créer le compte'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(tempSuccess)} onOpenChange={closeTempSuccess}>
        <DialogContent className="z-[110] max-w-md border-emerald-500/25 shadow-supra-glow sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-800 dark:text-emerald-200">Compte créé avec succès</DialogTitle>
            <DialogDescription>
              Transmettez ces informations au collaborateur par un canal sécurisé.
            </DialogDescription>
          </DialogHeader>
          {tempSuccess ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">E-mail</p>
                <p className="break-all rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm font-medium">
                  {tempSuccess.email}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mot de passe temporaire</p>
                <Input
                  readOnly
                  value={tempSuccess.temporaryPassword}
                  className="font-mono text-sm"
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full sm:w-auto"
                onClick={() => void copyTemporaryPassword(tempSuccess.temporaryPassword)}
              >
                {passwordCopied ? 'Copié' : 'Copier le mot de passe'}
              </Button>
              <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                Ce mot de passe est affiché une seule fois. Demandez au collaborateur de le changer après la première
                connexion.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="primary"
              className="w-full rounded-full sm:w-auto"
              onClick={() => closeTempSuccess(false)}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(linkedInfo)} onOpenChange={closeLinkedInfo}>
        <DialogContent className="z-[110] max-w-md">
          <DialogHeader>
            <DialogTitle>Compte Auth existant</DialogTitle>
            <DialogDescription className="text-left text-foreground/85">
              {linkedInfo?.message}
            </DialogDescription>
          </DialogHeader>
          {linkedInfo ? (
            <p className="break-all text-sm text-muted-foreground">
              <span className="font-medium text-foreground">E-mail : </span>
              {linkedInfo.email}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="primary" className="rounded-full" onClick={() => closeLinkedInfo(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
