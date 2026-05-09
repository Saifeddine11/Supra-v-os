'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@/types/database';
import { Label } from '@/components/ui/label';
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
import { changeEmployeeRoleAction, updateEmployeeSkillsAction } from './actions';
import { ROLE_LABELS, TEAM_ASSIGNABLE_ROLES } from '@/types/domain';
import { OperationalSkillsFields } from './operational-skills-fields';
import { Button } from '@/components/ui/button';

const selectCls =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground';

export function EmployeeRoleForm({
  employeeId,
  currentRole,
  operationalSkills,
}: {
  employeeId: string;
  currentRole: UserRole;
  operationalSkills: UserRole[];
}) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(currentRole);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmPromote, setConfirmPromote] = useState(false);
  const [confirmDemote, setConfirmDemote] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<UserRole | null>(null);
  const [skillsPending, setSkillsPending] = useState(false);
  const [skillsErr, setSkillsErr] = useState<string | null>(null);
  const [skillsOk, setSkillsOk] = useState<string | null>(null);

  useEffect(() => {
    setRole(currentRole);
  }, [currentRole]);

  async function apply(target: UserRole, opts?: { confirmPromoteAdmin?: boolean; confirmDemoteAdmin?: boolean }) {
    setErr(null);
    setPending(true);
    try {
      const res = await changeEmployeeRoleAction(employeeId, target, opts);
      if (!res.ok) {
        if (res.code === 'CONFIRM_PROMOTE_ADMIN') {
          setPendingTarget(target);
          setRole(currentRole);
          setConfirmPromote(true);
          return;
        }
        if (res.code === 'CONFIRM_DEMOTE_ADMIN') {
          setPendingTarget(target);
          setRole(currentRole);
          setConfirmDemote(true);
          return;
        }
        setErr(res.error);
        return;
      }
      setRole(target);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Impossible de modifier le rôle.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid max-w-md gap-6">
      <div className="grid gap-2">
        <Label htmlFor="role-select">Rôle principal</Label>
        <p className="text-xs text-muted-foreground">
          Le rôle principal contrôle les accès, la navigation et le tableau de bord. Il ne peut être modifié qu’ici (permissions).
        </p>
        <select
          id="role-select"
          className={selectCls}
          value={role}
          onChange={(e) => {
            const next = e.target.value as UserRole;
            void apply(next);
          }}
          disabled={pending}
        >
          {TEAM_ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <div className="grid gap-2 border-t border-border pt-4">
        <Label>Compétences opérationnelles</Label>
        <p className="text-xs text-muted-foreground">
          Les compétences servent aux assignations terrain (vidéos, charge, filtres équipe). Elles n’accordent pas de droits
          d’administration.
        </p>
        <form
          className="grid gap-3"
          action={async (formData) => {
            setSkillsErr(null);
            setSkillsOk(null);
            setSkillsPending(true);
            try {
              const res = await updateEmployeeSkillsAction(employeeId, formData);
              if (!res.ok) {
                setSkillsErr(res.error);
                return;
              }
              setSkillsOk('Compétences enregistrées.');
              router.refresh();
            } catch (e) {
              setSkillsErr(e instanceof Error ? e.message : 'Échec de l’enregistrement des compétences.');
            } finally {
              setSkillsPending(false);
            }
          }}
        >
          <OperationalSkillsFields defaultSelected={operationalSkills} />
          {skillsErr ? <p className="text-sm text-destructive">{skillsErr}</p> : null}
          {skillsOk ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{skillsOk}</p> : null}
          <Button type="submit" variant="outline" className="w-fit rounded-full" disabled={skillsPending}>
            {skillsPending ? 'Enregistrement…' : 'Enregistrer les compétences'}
          </Button>
        </form>
      </div>

      <AlertDialog open={confirmPromote} onOpenChange={(o) => { setConfirmPromote(o); if (!o) setPendingTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nommer administrateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette personne aura tous les droits d’administration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRole(currentRole); setPendingTarget(null); }}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmPromote(false);
                const t = pendingTarget;
                if (!t) return;
                void apply(t, { confirmPromoteAdmin: true });
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDemote} onOpenChange={(o) => { setConfirmDemote(o); if (!o) setPendingTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer le rôle administrateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Un autre administrateur actif doit rester dans l’équipe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRole(currentRole); setPendingTarget(null); }}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDemote(false);
                const t = pendingTarget;
                if (!t) return;
                void apply(t, { confirmDemoteAdmin: true });
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
