'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { archiveTaskAction, deleteTaskAction } from './actions';
import { toast } from 'sonner';

export type TaskConfirmActionMode = 'delete' | 'archive';

const COPY: Record<
  TaskConfirmActionMode,
  { title: string; description: string; confirm: string; loading: string; success: string }
> = {
  delete: {
    title: 'Supprimer cette tâche ?',
    description:
      'Cette action supprimera la tâche du planning. Voulez-vous continuer ?',
    confirm: 'Valider la suppression',
    loading: 'Suppression…',
    success: 'Tâche supprimée',
  },
  archive: {
    title: 'Archiver cette tâche ?',
    description:
      'Cette tâche sera retirée du planning actif. Voulez-vous continuer ?',
    confirm: 'Valider l’archivage',
    loading: 'Archivage…',
    success: 'Tâche archivée',
  },
};

/** Confirmation contrôlée (sans trigger) — évite le gel des modales Radix imbriquées. */
export function ConfirmTaskActionDialog({
  open,
  onOpenChange,
  mode,
  taskId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TaskConfirmActionMode | null;
  taskId: string;
  onSuccess: () => void;
}) {
  const [pending, setPending] = useState(false);
  const activeMode = mode ?? 'delete';
  const copy = COPY[activeMode];

  function handleOpenChange(next: boolean) {
    if (pending) return;
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!mode || pending) return;
    setPending(true);
    try {
      const res =
        mode === 'delete'
          ? await deleteTaskAction(taskId)
          : await archiveTaskAction(taskId);
      if (!res.ok) {
        toast.error(res.error || 'Action impossible.');
        return;
      }
      toast.success(copy.success);
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error('Action impossible. Veuillez réessayer.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        className={cn(
          'z-[112] w-[calc(100vw-2rem)] max-w-[420px] gap-4',
          'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
        )}
      >
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel
            disabled={pending}
            className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 w-full sm:w-auto')}
          >
            Annuler
          </AlertDialogCancel>
          <Button
            type="button"
            disabled={pending}
            variant="primary"
            className={cn(
              'min-h-11 w-full sm:w-auto',
              activeMode === 'delete' &&
                'bg-destructive text-destructive-foreground shadow-none hover:opacity-95',
              activeMode === 'archive' &&
                'bg-primary text-primary-foreground shadow-none hover:opacity-95',
            )}
            onClick={() => void handleConfirm()}
          >
            {pending ? copy.loading : copy.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
