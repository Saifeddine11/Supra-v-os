'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MoreHorizontal, Archive, ExternalLink, Trash2 } from 'lucide-react';
import type { Project } from '@/types/database';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { archiveProjectAction, deleteProjectAction } from './actions';

export function ProjectRowActions({
  project,
  canEdit,
  canDelete,
}: {
  project: Project;
  canEdit: boolean;
  canDelete: boolean;
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
          <Link href={`/projects/${project.id}`} className="flex cursor-pointer items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5" />
            Ouvrir la fiche
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/clients/${project.client_id}`} className="flex cursor-pointer items-center gap-2">
            Fiche client
          </Link>
        </DropdownMenuItem>
        {canEdit ? (
          <>
            <DropdownMenuSeparator />
            <ConfirmDialog
              title="Archiver ce projet ?"
              description="Le projet passera au statut archivé."
              confirmLabel="Archiver"
              onConfirm={async () => {
                await archiveProjectAction(project.id);
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
        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <ConfirmDialog
              title="Supprimer définitivement ?"
              description="Suppression irréversible (tâches liées en cascade)."
              confirmLabel="Supprimer"
              onConfirm={async () => {
                await deleteProjectAction(project.id);
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
