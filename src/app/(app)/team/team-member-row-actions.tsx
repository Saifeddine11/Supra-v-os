'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import type { TeamMemberRow } from '@/lib/data/team';
import type { ActionResult } from '@/lib/actions/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  archiveEmployeeAction,
  changeEmployeeRoleAction,
  deleteEmployeeAction,
  setEmployeeActiveAction,
  unarchiveEmployeeAction,
} from './actions';
import { inviteEmployeeAuthAction, sendEmployeePasswordResetAction } from './employee-auth-actions';
import { ROLE_LABELS, TEAM_ASSIGNABLE_ROLES } from '@/types/domain';
import type { UserRole } from '@/types/database';

export function TeamMemberRowActions({
  member,
  isAdmin,
}: {
  member: TeamMemberRow;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [authOk, setAuthOk] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmDemote, setConfirmDemote] = useState(false);
  const [confirmPromote, setConfirmPromote] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isAdmin) {
    return (
      <Link href={`/team/${member.id}`} className="text-xs font-medium text-primary hover:underline">
        Profil
      </Link>
    );
  }

  async function run(label: string, fn: () => Promise<ActionResult<unknown>>) {
    setErr(null);
    setAuthOk(null);
    setPending(label);
    try {
      const res = await fn();
      if (!res.ok) {
        if (res.code === 'CONFIRM_PROMOTE_ADMIN') {
          setConfirmPromote(true);
          return;
        }
        if (res.code === 'CONFIRM_DEMOTE_ADMIN') {
          setConfirmDemote(true);
          return;
        }
        setErr(res.error ?? 'Erreur');
        return;
      }
      const data = res.data as { archivedInstead?: boolean } | undefined;
      if (data?.archivedInstead) {
        setErr(null);
        router.refresh();
        window.alert(
          'Ce membre est lié à des tâches, vidéos ou projets. Il a été archivé et désactivé plutôt que supprimé.',
        );
        return;
      }
      setPendingRole(null);
      setMenuOpen(false);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function runInviteAuth() {
    setErr(null);
    setAuthOk(null);
    setPending('invite-auth');
    try {
      const res = await inviteEmployeeAuthAction(member.id);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setAuthOk(
        res.data?.mode === 'linked_existing'
          ? 'Compte Auth lié (utilisateur déjà présent).'
          : 'Invitation envoyée.',
      );
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function runPasswordReset() {
    setErr(null);
    setAuthOk(null);
    setPending('pwd-reset');
    try {
      const res = await sendEmployeePasswordResetAction(member.id);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setAuthOk('E-mail de réinitialisation envoyé.');
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href={`/team/${member.id}`}>Voir le profil</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/team/${member.id}`}>Modifier sur la fiche</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {!member.user_id && member.email?.trim() ? (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  void runInviteAuth();
                }}
              >
                Envoyer invitation Auth
              </DropdownMenuItem>
            ) : null}
            {member.user_id && member.email?.trim() ? (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  void runPasswordReset();
                }}
              >
                Réinitialisation mot de passe
              </DropdownMenuItem>
            ) : null}
            {member.email?.trim() ? <DropdownMenuSeparator /> : null}
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Changer le rôle</div>
            {TEAM_ASSIGNABLE_ROLES.filter((r) => r !== member.role).map((r) => (
              <DropdownMenuItem
                key={r}
                onSelect={(e) => {
                  e.preventDefault();
                  setPendingRole(r);
                  void run('role', () => changeEmployeeRoleAction(member.id, r));
                }}
              >
                {ROLE_LABELS[r]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {member.archived_at ? (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  void run('unarchive', () => unarchiveEmployeeAction(member.id));
                }}
              >
                Restaurer (désarchiver)
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    void run('active', () => setEmployeeActiveAction(member.id, !member.is_active));
                  }}
                >
                  {member.is_active ? 'Désactiver le compte' : 'Réactiver le compte'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setConfirmArchive(true);
                  }}
                >
                  Archiver
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setConfirmDelete(true);
                  }}
                >
                  Supprimer…
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {err ? <p className="max-w-[200px] text-right text-xs text-destructive">{err}</p> : null}
        {authOk ? <p className="max-w-[220px] text-right text-xs text-emerald-600 dark:text-emerald-400">{authOk}</p> : null}
        {pending ? <p className="text-xs text-muted-foreground">{pending}…</p> : null}
      </div>

      <AlertDialog open={confirmPromote} onOpenChange={(o) => { setConfirmPromote(o); if (!o) setPendingRole(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nommer administrateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              {member.full_name} aura tous les droits d’administration. Confirmez cette action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingRole(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmPromote(false);
                const r = pendingRole;
                if (!r) return;
                void run('promote', () =>
                  changeEmployeeRoleAction(member.id, r, { confirmPromoteAdmin: true }),
                );
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDemote} onOpenChange={(o) => { setConfirmDemote(o); if (!o) setPendingRole(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer le rôle administrateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Un autre administrateur actif doit rester dans l’équipe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingRole(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDemote(false);
                const r = pendingRole;
                if (!r) return;
                void run('demote', () =>
                  changeEmployeeRoleAction(member.id, r, { confirmDemoteAdmin: true }),
                );
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver ce membre ?</AlertDialogTitle>
            <AlertDialogDescription>
              Retiré des assignations, compte désactivé. L’historique est conservé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmArchive(false);
                void run('archive', () => archiveEmployeeAction(member.id));
              }}
            >
              Archiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Sans historique métier uniquement. Sinon archivage automatique.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmDelete(false);
                void run('delete', () => deleteEmployeeAction(member.id));
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
