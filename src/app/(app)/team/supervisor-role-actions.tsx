'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TaskDepartment, UserRole } from '@/types/database';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  makeDepartmentSupervisorAction,
  removeDepartmentSupervisorAction,
  makeProjectManagerAction,
  removeProjectManagerAction,
} from './actions';
import { departmentLabel, isProjectManager } from '@/lib/auth/supervision';

type ConfirmKind = 'make_supervisor' | 'remove_supervisor' | 'make_pm' | 'remove_pm' | null;

function givenName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || fullName || 'ce membre';
}

export function SupervisorRoleActions({
  employeeId,
  fullName,
  currentRole,
  department,
  isDepartmentSupervisor,
}: {
  employeeId: string;
  fullName: string;
  currentRole: UserRole;
  department: TaskDepartment | null;
  isDepartmentSupervisor: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const deptLabel = departmentLabel(department);
  const isPm = isProjectManager(currentRole);
  const isAdmin = currentRole === 'admin';
  const firstName = givenName(fullName);
  const showSupervisorCta = !isAdmin && !isPm;

  async function run(kind: Exclude<ConfirmKind, null>) {
    setErr(null);
    setPending(true);
    try {
      const res =
        kind === 'make_supervisor'
          ? await makeDepartmentSupervisorAction(employeeId)
          : kind === 'remove_supervisor'
            ? await removeDepartmentSupervisorAction(employeeId)
            : kind === 'make_pm'
              ? await makeProjectManagerAction(employeeId)
              : await removeProjectManagerAction(employeeId);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setPending(false);
      setConfirm(null);
    }
  }

  const confirmCopy =
    confirm === 'make_supervisor'
      ? {
          title: `Définir ${firstName} comme superviseur de ${deptLabel} ?`,
          description: `${firstName} pourra voir et gérer les membres et les tâches de ce pôle.`,
        }
      : confirm === 'remove_supervisor'
        ? {
            title: `Retirer le rôle de superviseur à ${firstName} ?`,
            description: `${firstName} restera ${department ? `membre du pôle ${deptLabel}` : 'dans l’équipe'}. Le métier ne change pas.`,
          }
        : confirm === 'make_pm'
          ? {
              title: `Nommer ${firstName} chef de projet ?`,
              description:
                'Le chef de projet pilote tous les pôles opérationnels, sans accès à l’administration financière globale.',
            }
          : confirm === 'remove_pm'
            ? {
                title: `Retirer le rôle de chef de projet à ${firstName} ?`,
                description: 'Les accès de pilotage global seront retirés. Le pôle éventuel reste inchangé.',
              }
            : null;

  const responsibilityLabel = isDepartmentSupervisor
    ? 'SUPERVISEUR'
    : isPm
      ? 'Chef de projet'
      : 'Membre du pôle';

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Responsabilité</p>
        <p className="mt-1 text-sm font-medium tracking-wide text-foreground">{responsibilityLabel}</p>
        {isDepartmentSupervisor && department ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Superviseur · {deptLabel}
          </p>
        ) : null}
      </div>

      {showSupervisorCta ? (
        isDepartmentSupervisor ? (
          <Button
            type="button"
            variant="outline"
            className="w-fit rounded-full"
            disabled={pending}
            onClick={() => setConfirm('remove_supervisor')}
          >
            Retirer le rôle de superviseur
          </Button>
        ) : department ? (
          <Button
            type="button"
            variant="primary"
            className="w-fit rounded-full"
            disabled={pending}
            onClick={() => setConfirm('make_supervisor')}
          >
            Définir comme superviseur du pôle
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Attribuez d’abord un pôle à ce membre pour pouvoir le nommer superviseur.
          </p>
        )
      ) : null}

      <div className="grid gap-2 border-t border-border pt-4">
        {isPm ? (
          <Button
            type="button"
            variant="outline"
            className="w-fit rounded-full"
            disabled={pending}
            onClick={() => setConfirm('remove_pm')}
          >
            Retirer le rôle de chef de projet
          </Button>
        ) : isAdmin ? null : (
          <Button
            type="button"
            variant="outline"
            className="w-fit rounded-full"
            disabled={pending}
            onClick={() => setConfirm('make_pm')}
          >
            Nommer chef de projet
          </Button>
        )}
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <AlertDialog open={confirm != null} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmCopy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending || !confirm}
              onClick={(e) => {
                e.preventDefault();
                if (confirm) void run(confirm);
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
