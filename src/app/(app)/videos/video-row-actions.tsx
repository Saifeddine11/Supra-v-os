'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { Client } from '@/types/database';
import type { VideoAssignEmployeeRow } from '@/lib/data/employees';
import type { VideoWithClient } from '@/lib/data/videos';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { VideoFormDialog } from './video-form-dialog';
import { deleteVideoAction } from './actions';

export function VideoRowActions({
  video,
  clients,
  employees,
  canDelete,
}: {
  video: VideoWithClient;
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: VideoAssignEmployeeRow[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <VideoFormDialog
        video={video}
        clients={clients}
        employees={employees}
        trigger={
          <Button variant="ghost" size="sm" className="h-8">
            Éditer
          </Button>
        }
      />
      {canDelete ? (
        <ConfirmDialog
          title="Supprimer cette vidéo ?"
          description="Irréversible. Réservé admin / chef de projet."
          confirmLabel="Supprimer"
          onConfirm={() =>
            startTransition(async () => {
              await deleteVideoAction(video.id);
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
