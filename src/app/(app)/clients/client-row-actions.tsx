'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import Link from 'next/link';
import { Archive, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ClientFormDialog } from './client-form-dialog';
import type { Client, Employee } from '@/types/database';
import { archiveClientAction, deleteClientAction } from './actions';

export function ClientRowActions({
  client,
  employees,
  canEdit,
  canDelete,
  onDeleted,
}: {
  client: Client;
  employees: Pick<Employee, 'id' | 'full_name'>[];
  canEdit: boolean;
  canDelete: boolean;
  /** Appelé après suppression réussie (ex. redirection depuis la fiche). */
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/clients/${client.id}`}>Voir</Link>
      </Button>
      {canEdit ? (
        <ClientFormDialog
          client={client}
          employees={employees}
          trigger={
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Modifier">
              <Pencil className="h-4 w-4" />
            </Button>
          }
        />
      ) : null}
      {canEdit ? (
        <ConfirmDialog
          title="Archiver ce client ?"
          description="Le statut passera à « Terminé ». Vous pourrez le réactiver plus tard."
          confirmLabel="Archiver"
          onConfirm={() =>
            startTransition(async () => {
              const res = await archiveClientAction(client.id);
              if (res.ok) router.refresh();
            })
          }
        >
          <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-300" title="Archiver">
            <Archive className="h-4 w-4" />
          </Button>
        </ConfirmDialog>
      ) : null}
      {canDelete ? (
        <ConfirmDialog
          title="Supprimer définitivement ?"
          description="Action irréversible. Les données liées peuvent empêcher la suppression."
          confirmLabel="Supprimer"
          onConfirm={() =>
            startTransition(async () => {
              const res = await deleteClientAction(client.id);
              if (res.ok) {
                onDeleted?.();
                router.refresh();
              }
            })
          }
        >
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Supprimer" disabled={pending}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
