'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ROLE_LABELS, TEAM_ASSIGNABLE_ROLES } from '@/types/domain';
import type { UserRole } from '@/types/database';
import { createEmployeeAction } from './actions';
import { Plus } from 'lucide-react';
import { OperationalSkillsFields } from './operational-skills-fields';

const selectCls =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground';

export function NewTeamMemberDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setErr(null); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="primary" className="rounded-full gap-2">
          <Plus className="h-4 w-4" />
          Nouveau membre
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau membre</DialogTitle>
          <DialogDescription>
            Crée le profil employé. Vous pouvez envoyer une invitation Supabase Auth tout de suite si la case ci-dessous
            est cochée.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 py-2"
          action={async (formData) => {
            setErr(null);
            setPending(true);
            try {
              const res = await createEmployeeAction(formData);
              if (!res.ok) {
                setErr(res.error);
                return;
              }
              setOpen(false);
              router.refresh();
              if (res.data?.authNotice) {
                window.alert(`Membre créé.\n\n${res.data.authNotice}`);
              }
              if (res.data?.id) router.push(`/team/${res.data.id}`);
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="nm-name">Nom complet</Label>
            <Input id="nm-name" name="full_name" required autoComplete="name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nm-email">E-mail</Label>
            <Input id="nm-email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nm-phone">Téléphone</Label>
            <Input id="nm-phone" name="phone" type="tel" autoComplete="tel" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nm-role">Rôle principal</Label>
            <p className="text-xs text-muted-foreground">
              Le rôle principal contrôle les accès. Les compétences servent aux assignations terrain.
            </p>
            <select id="nm-role" name="role" required className={selectCls} defaultValue="editor">
              {TEAM_ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r as UserRole]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Compétences opérationnelles</Label>
            <OperationalSkillsFields defaultSelected={[]} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nm-cap">Capacité hebdo (h)</Label>
            <Input id="nm-cap" name="weekly_capacity" type="number" min={1} max={80} defaultValue={40} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nm-ini">Initiales (avatar)</Label>
            <Input id="nm-ini" name="avatar_initials" maxLength={4} placeholder="Auto si vide" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nm-active">Compte</Label>
            <select id="nm-active" name="is_active" className={selectCls} defaultValue="true">
              <option value="true">Actif</option>
              <option value="false">Inactif</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nm-notes">Notes internes</Label>
            <Textarea id="nm-notes" name="notes_internal" rows={2} />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm leading-snug">
            <input id="nm-invite-auth" type="checkbox" name="invite_auth" value="on" className="mt-0.5 h-4 w-4 rounded border-input" />
            <span>
              <span className="font-medium text-foreground">Créer / inviter un compte de connexion</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Envoie une invitation Supabase à l’e-mail saisi et lie <span className="font-mono text-[10px]">user_id</span>{' '}
                si possible. Nécessite SMTP configuré côté projet.
              </span>
            </span>
          </label>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" className="rounded-full" disabled={pending}>
              {pending ? 'Création…' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
