'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { InvoiceWithClient } from '@/lib/data/invoices';
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
import { PAYMENT_METHOD_LABELS } from '@/types/domain';
import type { PaymentMethod } from '@/types/database';
import { createPaymentAction } from './actions';

const selectCls =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground';

export function PaymentFormDialog({
  invoices,
  trigger,
}: {
  invoices: InvoiceWithClient[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');

  const selectable = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft');

  useEffect(() => {
    if (!open) setErr(null);
  }, [open]);

  const selected = selectable.find((i) => i.id === invoiceId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          action={async (formData) => {
            setErr(null);
            setPending(true);
            try {
              const res = await createPaymentAction(formData);
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
          <div className="grid gap-2">
            <Label htmlFor="pay-inv">Facture</Label>
            <select
              id="pay-inv"
              name="invoice_id"
              required
              className={selectCls}
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
            >
              <option value="">—</option>
              {selectable.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.ref} · {i.clients?.name} · {i.total.toLocaleString('fr-FR')} {i.currency}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" name="client_id" value={selected?.client_id ?? ''} readOnly />
          <input type="hidden" name="currency" value={selected?.currency ?? 'MAD'} readOnly />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pay-amt">Montant</Label>
              <Input
                key={invoiceId || 'none'}
                id="pay-amt"
                name="amount"
                type="number"
                min={0.01}
                step={0.01}
                required
                defaultValue={selected?.total ?? ''}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pay-date">Date</Label>
              <Input id="pay-date" name="payment_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pay-method">Moyen</Label>
            <select id="pay-method" name="method" className={selectCls} defaultValue="bank_transfer">
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pay-ref">Référence (optionnel)</Label>
            <Input id="pay-ref" name="reference" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pay-notes">Notes</Label>
            <Textarea id="pay-notes" name="notes" rows={2} />
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <Button type="submit" variant="primary" className="rounded-full" disabled={pending || !selected}>
            {pending ? 'Enregistrement…' : 'Valider le paiement'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
