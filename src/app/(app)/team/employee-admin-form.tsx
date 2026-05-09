'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Employee } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateEmployeeAdminAction } from './actions';

const selectCls =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground';

export function EmployeeAdminForm({ employee }: { employee: Employee }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const authLinked = Boolean(employee.user_id);

  return (
    <form
      className="grid max-w-xl gap-4"
      action={async (formData) => {
        setErr(null);
        setOk(null);
        setPending(true);
        try {
          const res = await updateEmployeeAdminAction(employee.id, formData);
          if (!res.ok) {
            setErr(res.error);
            return;
          }
          setOk('Enregistré.');
          router.refresh();
        } catch (e) {
          setErr(e instanceof Error ? e.message : 'Échec de l’enregistrement.');
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="e-name">Nom complet</Label>
        <Input id="e-name" name="full_name" required defaultValue={employee.full_name} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="e-email">E-mail</Label>
        <Input
          id="e-email"
          name="email"
          type="email"
          required
          defaultValue={employee.email}
          readOnly={authLinked}
          className={authLinked ? 'opacity-80' : ''}
        />
        {authLinked ? (
          <p className="text-xs text-muted-foreground">
            Compte Auth lié : modifiez l’e-mail dans Supabase Auth si nécessaire.
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="e-phone">Téléphone</Label>
        <Input id="e-phone" name="phone" defaultValue={employee.phone ?? ''} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="e-ini">Initiales (avatar)</Label>
        <Input id="e-ini" name="avatar_initials" maxLength={4} defaultValue={employee.avatar_initials ?? ''} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="e-cap">Capacité hebdo (h)</Label>
        <Input
          id="e-cap"
          name="weekly_capacity"
          type="number"
          min={1}
          max={80}
          defaultValue={employee.weekly_capacity}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="e-active">Compte actif / inactif</Label>
        <select
          id="e-active"
          name="is_active"
          className={selectCls}
          defaultValue={employee.is_active ? 'true' : 'false'}
        >
          <option value="true">Actif</option>
          <option value="false">Inactif</option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="e-notes">Notes internes</Label>
        <Textarea id="e-notes" name="notes_internal" rows={3} defaultValue={employee.notes_internal ?? ''} />
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {ok ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{ok}</p> : null}
      <Button type="submit" variant="primary" className="w-fit rounded-full" disabled={pending}>
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
