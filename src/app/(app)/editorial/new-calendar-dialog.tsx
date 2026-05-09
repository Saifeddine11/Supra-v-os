'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Client } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { upsertEditorialCalendarAction } from './actions';

const selectCls =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground';

export function NewEditorialCalendarDialog({
  clients,
  year,
  month,
  trigger,
}: {
  clients: Pick<Client, 'id' | 'name'>[];
  year: number;
  month: number;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Calendrier éditorial mensuel</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          action={async (formData) => {
            setErr(null);
            setPending(true);
            try {
              formData.set('year', String(year));
              formData.set('month', String(month));
              const res = await upsertEditorialCalendarAction(formData);
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
        >
          <input type="hidden" name="year" value={year} readOnly />
          <input type="hidden" name="month" value={month} readOnly />
          <div className="grid gap-2">
            <Label htmlFor="ec-client">Client</Label>
            <select id="ec-client" name="client_id" required className={selectCls}>
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ec-quota">Quota mensuel (vidéos)</Label>
            <Input id="ec-quota" name="quota" type="number" min={0} defaultValue={4} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ec-notes">Notes</Label>
            <Textarea id="ec-notes" name="notes" rows={2} />
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <Button type="submit" variant="primary" className="rounded-full" disabled={pending}>
            {pending ? 'Enregistrement…' : 'Créer / mettre à jour'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
