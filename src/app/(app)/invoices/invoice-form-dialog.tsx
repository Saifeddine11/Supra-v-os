'use client';

import { useEffect, useState } from 'react';
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
import { createInvoiceAction } from './actions';

export function InvoiceFormDialog({
  clients,
  trigger,
}: {
  clients: Pick<Client, 'id' | 'name'>[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) setErr(null);
  }, [open]);

  const defaultDue = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle facture (brouillon)</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            setErr(null);
            setPending(true);
            try {
              const res = await createInvoiceAction(formData);
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
          <div className="grid gap-2">
            <Label htmlFor="inv-client">Client</Label>
            <select
              id="inv-client"
              name="client_id"
              required
              className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
            >
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="inv-desc">Libellé ligne</Label>
              <Input id="inv-desc" name="line_description" defaultValue="Prestation" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-unit">Unité</Label>
              <Input id="inv-unit" name="line_unit" placeholder="ex. forfait" />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="inv-qty">Quantité</Label>
              <Input id="inv-qty" name="line_quantity" type="number" min={1} step={1} defaultValue={1} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-price">Prix unitaire (HT)</Label>
              <Input id="inv-price" name="line_unit_price" type="number" min={0} step={0.01} required />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="inv-tax">TVA %</Label>
              <Input id="inv-tax" name="tax_rate" type="number" min={0} step={0.5} defaultValue={20} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-disc">Remise</Label>
              <Input id="inv-disc" name="discount" type="number" min={0} step={0.01} defaultValue={0} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="inv-due">Échéance</Label>
              <Input id="inv-due" name="due_date" type="date" required defaultValue={defaultDue()} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-cur">Devise</Label>
              <Input id="inv-cur" name="currency" defaultValue="MAD" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inv-notes">Notes</Label>
            <Textarea id="inv-notes" name="notes" rows={2} />
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? '…' : 'Créer brouillon'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
