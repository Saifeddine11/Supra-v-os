import Link from 'next/link';
import type { Employee, UserRole } from '@/types/database';
import { ROLE_LABELS, OPERATIONAL_SKILL_ROLES } from '@/types/domain';
import { Badge } from '@/components/ui/badge';

export function PersonalAccountSettingsSection({
  employee,
  email,
  role,
}: {
  employee: Employee;
  email: string;
  role: UserRole;
}) {
  const skills = (employee.operational_skills ?? []).filter((s) => OPERATIONAL_SKILL_ROLES.includes(s));

  return (
    <dl className="grid gap-3 text-sm">
      <div>
        <dt className="text-xs text-muted-foreground">Nom</dt>
        <dd className="text-foreground">{employee.full_name}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">E-mail</dt>
        <dd className="break-all text-foreground">{email || employee.email}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Rôle</dt>
        <dd className="text-foreground">{ROLE_LABELS[role]}</dd>
      </div>
      {skills.length > 0 ? (
        <div>
          <dt className="text-xs text-muted-foreground">Compétences opérationnelles</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px] font-normal">
                {ROLE_LABELS[s]}
              </Badge>
            ))}
          </dd>
        </div>
      ) : null}
      <div>
        <dt className="text-xs text-muted-foreground">Connexion Supabase Auth</dt>
        <dd>
          {employee.user_id ? (
            <Badge variant="outline" className="border-emerald-500/40 font-normal text-emerald-800 dark:text-emerald-300">
              Compte lié
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/50 font-normal text-amber-800 dark:text-amber-200">
              Non lié — contactez un administrateur
            </Badge>
          )}
        </dd>
      </div>
      <div>
        <Link href={`/team/${employee.id}`} className="text-sm font-medium text-primary hover:underline">
          Voir ma fiche équipe →
        </Link>
      </div>
    </dl>
  );
}
