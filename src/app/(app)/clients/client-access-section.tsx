'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientUser } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  AUTH_EMAIL_RATE_LIMIT_USER_MESSAGE,
  isAuthEmailRateLimitError,
} from '@/lib/employees/auth-email-errors';
import {
  createClientUserAccess,
  resetClientUserPassword,
  setClientUserActive,
} from './client-access-actions';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ClientAccessSection({
  clientId,
  users,
  loadError,
  defaultFullName,
  defaultEmail,
}: {
  clientId: string;
  users: ClientUser[];
  loadError: string | null;
  defaultFullName: string;
  defaultEmail: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [fullName, setFullName] = useState(defaultFullName);
  const [email, setEmail] = useState(defaultEmail);
  const [passwordMode, setPasswordMode] = useState<'invite' | 'temporary'>('invite');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function resetCreateForm() {
    setFullName(defaultFullName);
    setEmail(defaultEmail);
    setPasswordMode('invite');
    setTempPassword(null);
    setCopied(false);
  }

  async function onCreate() {
    setError(null);
    setMessage(null);
    setPending('create');
    try {
      const res = await createClientUserAccess(clientId, fullName, email, passwordMode);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data?.mode === 'temp_password') {
        setTempPassword(res.data.temporaryPassword);
        setMessage(res.data.message);
      } else {
        setMessage(res.data?.message ?? 'Invitation envoyée.');
        setCreateOpen(false);
        resetCreateForm();
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function onReset(id: string) {
    setError(null);
    setMessage(null);
    setPending(`reset:${id}`);
    try {
      const res = await resetClientUserPassword(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage('E-mail de réinitialisation envoyé.');
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function onToggle(id: string, isActive: boolean) {
    setError(null);
    setMessage(null);
    setPending(`toggle:${id}`);
    try {
      const res = await setClientUserActive(id, isActive);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(isActive ? 'Accès réactivé.' : 'Accès désactivé.');
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Comptes de connexion distincts de l’équipe interne. Le tableau de bord client n’est pas encore
        disponible — le portail par jeton reste inchangé.
      </p>

      {loadError ? (
        <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          {loadError}
        </p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun accès client pour le moment.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {users.map((user) => (
            <li key={user.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{user.full_name?.trim() || '—'}</p>
                <p className="break-all text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {user.is_active ? (
                    <Badge variant="success">Actif</Badge>
                  ) : (
                    <Badge variant="outline">Inactif</Badge>
                  )}
                  {user.must_change_password ? (
                    <Badge variant="warning">Mot de passe à changer</Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Dernière connexion {formatDate(user.last_login_at)} · Créé {formatDate(user.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={Boolean(pending) || !user.is_active}
                  onClick={() => void onReset(user.id)}
                >
                  {pending === `reset:${user.id}` ? 'Envoi…' : 'Réinitialiser mot de passe'}
                </Button>
                {user.is_active ? (
                  <ConfirmDialog
                    title="Désactiver cet accès ?"
                    description="Le compte Auth est conservé. La personne ne pourra plus se connecter tant que l’accès n’est pas réactivé."
                    confirmLabel="Désactiver accès"
                    onConfirm={() => onToggle(user.id, false)}
                  >
                    <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={Boolean(pending)}>
                      Désactiver accès
                    </Button>
                  </ConfirmDialog>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={Boolean(pending)}
                    onClick={() => void onToggle(user.id, true)}
                  >
                    Réactiver accès
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="primary"
        size="sm"
        className="rounded-full"
        disabled={Boolean(loadError)}
        onClick={() => {
          resetCreateForm();
          setError(null);
          setCreateOpen(true);
        }}
      >
        Créer un accès
      </Button>

      {error ? (
        <div
          className={
            isAuthEmailRateLimitError(error) || error === AUTH_EMAIL_RATE_LIMIT_USER_MESSAGE
              ? 'rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100'
              : 'text-sm text-destructive'
          }
          role="alert"
        >
          {error}
          {isAuthEmailRateLimitError(error) || error === AUTH_EMAIL_RATE_LIMIT_USER_MESSAGE ? (
            <p className="mt-2 text-xs opacity-90">
              Utilisez le mode mot de passe temporaire, ou configurez un SMTP personnalisé dans Supabase.
            </p>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p> : null}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (pending === 'create') return;
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un accès</DialogTitle>
            <DialogDescription>
              Invitation par e-mail recommandée. Le mot de passe temporaire n’est affiché qu’une fois.
            </DialogDescription>
          </DialogHeader>

          {tempPassword ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">Transmettez ces identifiants au client par un canal sûr.</p>
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">E-mail</p>
                <p className="break-all rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm">{email}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mot de passe temporaire</p>
                <p className="select-all rounded-xl border border-border bg-muted/50 px-3 py-3 font-mono text-sm tracking-wide">
                  {tempPassword}
                </p>
              </div>
              <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                Ce mot de passe est affiché une seule fois.
              </p>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    void navigator.clipboard.writeText(tempPassword).then(() => setCopied(true));
                  }}
                >
                  {copied ? 'Copié' : 'Copier'}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="rounded-full"
                  onClick={() => {
                    setCreateOpen(false);
                    resetCreateForm();
                  }}
                >
                  Fermer
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client-access-name">Nom complet</Label>
                  <Input
                    id="client-access-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Marie Dupont"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-access-email">E-mail</Label>
                  <Input
                    id="client-access-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="marie@client.com"
                    autoComplete="email"
                  />
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-foreground">Mode mot de passe</legend>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="client-access-mode"
                      className="mt-1"
                      checked={passwordMode === 'invite'}
                      onChange={() => setPasswordMode('invite')}
                    />
                    <span>
                      Envoyer une invitation e-mail
                      <span className="block text-xs text-muted-foreground">Redirige vers /auth/set-password</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="client-access-mode"
                      className="mt-1"
                      checked={passwordMode === 'temporary'}
                      onChange={() => setPasswordMode('temporary')}
                    />
                    <span>
                      Créer un mot de passe temporaire
                      <span className="block text-xs text-muted-foreground">Si l’invitation e-mail n’est pas disponible</span>
                    </span>
                  </label>
                </fieldset>
              </div>
              {error && createOpen ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  disabled={pending === 'create'}
                  onClick={() => {
                    setCreateOpen(false);
                    resetCreateForm();
                  }}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="rounded-full"
                  disabled={pending === 'create' || !email.trim()}
                  onClick={() => void onCreate()}
                >
                  {pending === 'create' ? 'Création…' : 'Créer l’accès'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
