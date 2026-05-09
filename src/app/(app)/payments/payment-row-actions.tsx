'use client';

import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { deletePaymentAction } from './actions';

export function PaymentRowActions({ paymentId, canDelete }: { paymentId: string; canDelete: boolean }) {
  const router = useRouter();
  if (!canDelete) return null;

  return (
    <ConfirmDialog
      title="Supprimer ce paiement ?"
      description="La facture liée sera recalculée (statut et solde). Action irréversible."
      confirmLabel="Supprimer"
      onConfirm={async () => {
        const res = await deletePaymentAction(paymentId);
        if (!res.ok) {
          window.alert(res.error);
          return;
        }
        router.refresh();
      }}
    >
      <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full text-destructive" aria-label="Supprimer le paiement">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </ConfirmDialog>
  );
}
