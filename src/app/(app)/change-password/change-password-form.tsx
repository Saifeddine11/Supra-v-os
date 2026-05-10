'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changeStaffPasswordAction } from './actions';

export function ChangePasswordForm({ employeeFirstName }: { employeeFirstName: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      const res = await changeStaffPasswordAction(password, confirm);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.replace('/dashboard');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">
          Nouveau mot de passe
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bonjour {employeeFirstName}, choisissez un mot de passe sécurisé pour continuer.
        </p>
      </div>

      <form
        onSubmit={(ev) => void onSubmit(ev)}
        className="rounded-2xl border border-border/80 bg-card/95 p-6 shadow-supra-glow backdrop-blur-sm sm:p-8"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="np">Nouveau mot de passe</Label>
            <Input
              id="np"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
              placeholder="Au moins 8 caractères"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="npc">Confirmer</Label>
            <Input
              id="npc"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
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
            {pending ? 'Enregistrement…' : 'Enregistrer et accéder au tableau de bord'}
          </Button>
        </div>
      </form>
    </div>
  );
}
