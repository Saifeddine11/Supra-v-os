'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { FileDown } from 'lucide-react';
import type { Invoice, InvoiceStatus } from '@/types/database';
import { INVOICE_STATUS_MAP } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { deleteInvoiceAction, markInvoicePaidAction, updateInvoiceStatusAction } from './actions';

export function InvoiceRowActions({
  invoice,
  canView,
  canModify,
}: {
  invoice: Invoice;
  canView: boolean;
  canModify: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!canView) return null;

  if (!canModify) {
    return (
      <div className="flex flex-wrap justify-end gap-1">
        <Button variant="ghost" size="sm" className="h-8" asChild>
          <Link href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer" prefetch={false}>
            <FileDown className="h-3.5 w-3.5" />
            PDF
          </Link>
        </Button>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const overdue =
    invoice.status !== 'paid' &&
    invoice.status !== 'cancelled' &&
    invoice.status !== 'draft' &&
    invoice.due_date < today;

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button variant="ghost" size="sm" className="h-8" asChild>
        <Link href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer" prefetch={false}>
          <FileDown className="h-3.5 w-3.5" />
          PDF
        </Link>
      </Button>
      <select
        className="h-8 max-w-[130px] rounded-md border border-border bg-muted px-2 text-xs"
        value={invoice.status}
        disabled={pending}
        onChange={(e) => {
          const s = e.target.value as InvoiceStatus;
          startTransition(async () => {
            await updateInvoiceStatusAction(invoice.id, s);
            router.refresh();
          });
        }}
      >
        {(['draft', 'sent', 'pending', 'paid', 'overdue', 'cancelled'] as InvoiceStatus[]).map((s) => (
          <option key={s} value={s}>
            {INVOICE_STATUS_MAP[s].label}
          </option>
        ))}
      </select>
      {invoice.status !== 'paid' && invoice.status !== 'cancelled' ? (
        <ConfirmDialog
          title="Marquer comme payée ?"
          description="La facture passera au statut Payée avec la date du jour."
          confirmLabel="Marquer payée"
          variant="default"
          onConfirm={() =>
            startTransition(async () => {
              await markInvoicePaidAction(invoice.id);
              router.refresh();
            })
          }
        >
          <Button variant="ghost" size="sm" className="h-8 text-emerald-400">
            Payée
          </Button>
        </ConfirmDialog>
      ) : null}
      {overdue ? (
        <span className="self-center text-[10px] font-medium text-destructive">Retard</span>
      ) : null}
      <ConfirmDialog
        title="Supprimer cette facture ?"
        description="Irréversible. Réservé aux rôles autorisés."
        confirmLabel="Supprimer"
        onConfirm={() =>
          startTransition(async () => {
            await deleteInvoiceAction(invoice.id);
            router.refresh();
          })
        }
      >
        <Button variant="ghost" size="sm" className="h-8 text-destructive" disabled={pending}>
          Suppr.
        </Button>
      </ConfirmDialog>
    </div>
  );
}
