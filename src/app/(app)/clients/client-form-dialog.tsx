'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Client } from '@/types/database';
import type { Employee } from '@/types/database';
import { SECTORS } from '@/types/domain';
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
import { createClientAction, updateClientAction } from './actions';
import { AGENCY_CURRENCY_SELECT_OPTIONS, normalizeAgencyCurrency } from '@/lib/money/format-money';

const STATUSES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'active', label: 'Actif' },
  { value: 'pause', label: 'En pause' },
  { value: 'terminated', label: 'Terminé' },
] as const;

const CONTRACTS = [
  { value: 'monthly', label: 'Mensuel' },
  { value: 'one_shot', label: 'One-shot' },
  { value: 'retainer', label: 'Retainer' },
] as const;

export function ClientFormDialog({
  employees,
  client,
  defaultAgencyCurrency,
  trigger,
}: {
  employees: Pick<Employee, 'id' | 'full_name'>[];
  client?: Client | null;
  /** Devise par défaut à la création (Paramètres agence). */
  defaultAgencyCurrency: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isEdit = Boolean(client);

  useEffect(() => {
    if (!open) setErr(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le client' : 'Nouveau client'}</DialogTitle>
          <DialogDescription>
            Les champs marqués d’un astérisque sont obligatoires. Les modifications respectent les rôles RLS.
          </DialogDescription>
        </DialogHeader>
        <form
          action={async (formData) => {
            setErr(null);
            setPending(true);
            try {
              const res = isEdit
                ? await updateClientAction(client!.id, formData)
                : await createClientAction(formData);
              if (!res.ok) {
                setErr(res.error);
                return;
              }
              router.refresh();
              setOpen(false);
            } finally {
              setPending(false);
            }
          }}
          className="grid gap-4"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Nom *</Label>
              <Input id="name" name="name" required defaultValue={client?.name} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sector">Secteur *</Label>
              <select
                id="sector"
                name="sector"
                required
                defaultValue={client?.sector}
                className="flex h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <option value="">—</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <select
                id="status"
                name="status"
                defaultValue={client?.status ?? 'prospect'}
                className="flex h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contract_type">Type de contrat</Label>
              <select
                id="contract_type"
                name="contract_type"
                defaultValue={client?.contract_type ?? 'one_shot'}
                className="flex h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {CONTRACTS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_contact">Contact principal</Label>
              <Input id="primary_contact" name="primary_contact" defaultValue={client?.primary_contact ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" defaultValue={client?.email ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" name="phone" defaultValue={client?.phone ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ville</Label>
              <Input id="city" name="city" defaultValue={client?.city ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Pays</Label>
              <Input id="country" name="country" defaultValue={client?.country ?? 'Maroc'} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="legal_name">Raison sociale</Label>
              <Input id="legal_name" name="legal_name" defaultValue={client?.legal_name ?? ''} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="services">Services (séparés par virgule)</Label>
              <Input
                id="services"
                name="services"
                placeholder="Vidéo, SEO, Site Web"
                defaultValue={client?.services?.join(', ') ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly_video_quota">Quota vidéos / mois</Label>
              <Input
                id="monthly_video_quota"
                name="monthly_video_quota"
                type="number"
                min={0}
                defaultValue={client?.monthly_video_quota ?? 0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly_fee">Montant forfaitaire</Label>
              <Input
                id="monthly_fee"
                name="monthly_fee"
                type="number"
                min={0}
                step="0.01"
                defaultValue={client?.monthly_fee ?? 0}
              />
              <p className="text-[11px] text-muted-foreground">
                Mensuel / retainer : montant par mois. One-shot : montant unique (compté le mois de la date de début).
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2 grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">Date de début contrat</Label>
                <Input
                  id="start_date"
                  name="start_date"
                  type="date"
                  defaultValue={client?.start_date ?? ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Date de fin (optionnel)</Label>
                <Input id="end_date" name="end_date" type="date" defaultValue={client?.end_date ?? ''} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Devise</Label>
              <select
                id="currency"
                name="currency"
                className="flex h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                defaultValue={normalizeAgencyCurrency(client?.currency ?? defaultAgencyCurrency)}
              >
                {AGENCY_CURRENCY_SELECT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="account_manager_id">Account manager</Label>
              <select
                id="account_manager_id"
                name="account_manager_id"
                defaultValue={client?.account_manager_id ?? ''}
                className="flex h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <option value="">—</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes_internal">Notes internes</Label>
              <Textarea id="notes_internal" name="notes_internal" defaultValue={client?.notes_internal ?? ''} />
            </div>
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
