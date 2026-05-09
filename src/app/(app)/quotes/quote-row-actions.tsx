'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { Quote, QuoteStatus } from '@/types/database';
import { QUOTE_STATUS_MAP } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { convertQuoteToInvoiceAction, deleteQuoteAction, updateQuoteStatusAction } from './actions';

export function QuoteRowActions({ quote, canModify }: { quote: Quote; canModify: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!canModify) {
    return (
      <Button variant="ghost" size="sm" className="h-8" asChild>
        <Link href={`/quotes/${quote.id}`}>Détail</Link>
      </Button>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const expiredUi = quote.status !== 'converted' && quote.status !== 'accepted' && quote.valid_until < today;

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button variant="ghost" size="sm" className="h-8" asChild>
        <Link href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer">
          PDF
        </Link>
      </Button>
      <Button variant="ghost" size="sm" className="h-8" asChild>
        <Link href={`/quotes/${quote.id}`}>Éditer</Link>
      </Button>
      <select
        className="h-8 max-w-[130px] rounded-md border border-border bg-muted px-2 text-xs"
        value={quote.status}
        disabled={pending || quote.status === 'converted'}
        onChange={(e) => {
          const s = e.target.value as QuoteStatus;
          startTransition(async () => {
            await updateQuoteStatusAction(quote.id, s);
            router.refresh();
          });
        }}
      >
        {(['draft', 'sent', 'accepted', 'refused', 'expired', 'converted'] as QuoteStatus[]).map((s) => (
          <option key={s} value={s}>
            {QUOTE_STATUS_MAP[s].label}
          </option>
        ))}
      </select>
      {quote.status === 'accepted' && !quote.converted_invoice_id ? (
        <ConfirmDialog
          title="Convertir en facture ?"
          description="Une facture brouillon sera créée avec les mêmes lignes. Le devis passera en « Converti »."
          confirmLabel="Convertir"
          onConfirm={() =>
            startTransition(async () => {
              await convertQuoteToInvoiceAction(quote.id);
              router.refresh();
            })
          }
        >
          <Button variant="ghost" size="sm" className="h-8 text-primary">
            → Facture
          </Button>
        </ConfirmDialog>
      ) : null}
      {quote.converted_invoice_id ? (
        <Button variant="ghost" size="sm" className="h-8" asChild>
          <Link href="/invoices">Facture liée</Link>
        </Button>
      ) : null}
      {expiredUi ? (
        <span className="self-center text-[10px] font-medium text-muted-foreground">Échu</span>
      ) : null}
      {quote.status !== 'converted' ? (
        <ConfirmDialog
          title="Supprimer ce devis ?"
          description="Action irréversible."
          confirmLabel="Supprimer"
          onConfirm={() =>
            startTransition(async () => {
              await deleteQuoteAction(quote.id);
              router.refresh();
            })
          }
        >
          <Button variant="ghost" size="sm" className="h-8 text-destructive" disabled={pending}>
            Suppr.
          </Button>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
