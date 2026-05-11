'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
import { Badge } from '@/components/ui/badge';
import { PAYMENT_METHOD_LABELS, INVOICE_STATUS_MAP } from '@/types/domain';
import type { PaymentMethod } from '@/types/database';
import { createPaymentAction } from './actions';
import { formatAgencyMoneyCompact } from '@/lib/money/format-money';

const selectCls =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground';

export function PaymentFormDialog({
  invoices,
  agencyDisplayCurrency,
  trigger,
}: {
  invoices: InvoiceWithClient[];
  agencyDisplayCurrency: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');

  const selectable = useMemo(
    () => invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft'),
    [invoices],
  );

  useEffect(() => {
    if (!open) setErr(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (selectable.length === 0) {
      setInvoiceId('');
      return;
    }
    setInvoiceId((prev) => (prev && selectable.some((i) => i.id === prev) ? prev : selectable[0]!.id));
  }, [open, selectable]);

  const selected = selectable.find((i) => i.id === invoiceId);
  const invStatusLabel = selected ? INVOICE_STATUS_MAP[selected.status]?.label : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Nouveau paiement</DialogTitle>
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
              toast.success('Paiement enregistré');
              router.refresh();
              setOpen(false);
            } finally {
              setPending(false);
            }
          }}
        >
          {selectable.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
              Aucune facture éligible pour un encaissement (toutes sont payées, annulées ou en brouillon). Créez ou
              réactivez une facture depuis{' '}
              <Link href="/invoices" className="font-medium text-primary underline-offset-4 hover:underline">
                Factures
              </Link>
              .
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="pay-inv">Facture liée</Label>
            <select
              id="pay-inv"
              name="invoice_id"
              required={selectable.length > 0}
              className={selectCls}
              value={invoiceId}
              disabled={selectable.length === 0}
              onChange={(e) => setInvoiceId(e.target.value)}
            >
              <option value="">—</option>
              {selectable.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.ref} · {i.clients?.name} · {formatAgencyMoneyCompact(i.total, agencyDisplayCurrency)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label>Client</Label>
            <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground">
              {selected?.clients?.name ?? '—'}
            </p>
          </div>

          {selected && invStatusLabel ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Statut facture</span>
              <Badge variant="outline" className="font-normal">
                {invStatusLabel}
              </Badge>
            </div>
          ) : null}

          <input type="hidden" name="client_id" value={selected?.client_id ?? ''} readOnly />
          <input type="hidden" name="currency" value={selected?.currency ?? agencyDisplayCurrency} readOnly />
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
                disabled={!selected}
                defaultValue={selected?.total ?? ''}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pay-date">Date de paiement</Label>
              <Input
                id="pay-date"
                name="payment_date"
                type="date"
                required
                disabled={!selected}
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pay-method">Moyen de paiement</Label>
            <select id="pay-method" name="method" className={selectCls} defaultValue="bank_transfer" disabled={!selected}>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pay-ref">Référence (optionnel)</Label>
            <Input id="pay-ref" name="reference" disabled={!selected} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pay-notes">Notes</Label>
            <Textarea id="pay-notes" name="notes" rows={2} disabled={!selected} />
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" className="rounded-full" disabled={pending || !selected}>
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
