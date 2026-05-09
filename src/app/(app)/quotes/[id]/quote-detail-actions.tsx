'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { Quote } from '@/types/database';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { convertQuoteToInvoiceAction } from '../actions';

export function QuoteDetailActions({ quote, canModify }: { quote: Quote; canModify: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [convertErr, setConvertErr] = useState<string | null>(null);

  if (!canModify) return null;

  return (
    <>
      {convertErr ? <p className="w-full text-sm text-destructive">{convertErr}</p> : null}
      {quote.status === 'accepted' && !quote.converted_invoice_id ? (
        <ConfirmDialog
          title="Convertir en facture ?"
          description="Une facture brouillon sera créée avec les mêmes lignes. Le devis passera en « Converti »."
          confirmLabel="Convertir"
          onConfirm={() =>
            startTransition(async () => {
              setConvertErr(null);
              const res = await convertQuoteToInvoiceAction(quote.id);
              if (res.ok) {
                router.push(`/invoices`);
                router.refresh();
              } else {
                setConvertErr(res.error);
              }
            })
          }
        >
          <Button variant="primary" size="sm" className="rounded-full" disabled={pending}>
            Convertir en facture
          </Button>
        </ConfirmDialog>
      ) : null}
      {quote.converted_invoice_id ? (
        <Button variant="outline" size="sm" className="rounded-full" asChild>
          <Link href="/invoices">Voir les factures</Link>
        </Button>
      ) : null}
    </>
  );
}
