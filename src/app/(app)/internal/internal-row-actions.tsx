'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MoreHorizontal, Archive, ExternalLink, Trash2 } from 'lucide-react';
import type { InternalProject } from '@/types/database';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { archiveInternalProjectAction, deleteInternalProjectAction } from './actions';

export function InternalProjectRowActions({
  project,
  canEdit,
  isAdmin,
}: {
  project: InternalProject;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" aria-label="Actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`/internal/${project.id}`} className="flex cursor-pointer items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5" />
            Fiche
          </Link>
        </DropdownMenuItem>
        {canEdit ? (
          <>
            <DropdownMenuSeparator />
            <ConfirmDialog
              title="Archiver ce projet interne ?"
              description="Statut archivé — les tâches liées restent consultables."
              confirmLabel="Archiver"
              onConfirm={async () => {
                await archiveInternalProjectAction(project.id);
                router.refresh();
              }}
            >
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer gap-2 text-amber-600">
                <Archive className="h-3.5 w-3.5" />
                Archiver
              </DropdownMenuItem>
            </ConfirmDialog>
          </>
        ) : null}
        {isAdmin ? (
          <>
            <DropdownMenuSeparator />
            <ConfirmDialog
              title="Supprimer définitivement ?"
              description="Action irréversible."
              confirmLabel="Supprimer"
              onConfirm={async () => {
                await deleteInternalProjectAction(project.id);
                router.refresh();
              }}
            >
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer gap-2 text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </DropdownMenuItem>
            </ConfirmDialog>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
