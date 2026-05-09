import type { Metadata } from 'next';
import Link from 'next/link';
import { listTeamMembersWithStats, type TeamListFilters } from '@/lib/data/team';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageEmployees } from '@/lib/auth/capabilities';
import { ROLE_LABELS } from '@/types/domain';
import type { UserRole } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { UserAvatar } from '@/components/shared/user-avatar';
import { TeamToolbar } from './team-toolbar';
import { NewTeamMemberDialog } from './new-member-dialog';
import { TeamMemberRowActions } from './team-member-row-actions';

export const metadata: Metadata = { title: 'Équipe' };

const AVAIL_LABEL: Record<string, string> = {
  available: 'Disponible',
  busy: 'Occupé',
  overloaded: 'Surchargé',
  inactive: 'Inactif',
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    role?: string;
    skill?: string;
    availability?: string;
    account?: string;
    archived?: string;
    overdue?: string;
  }>;
}) {
  const sp = await searchParams;
  const ctx = await getAuthContext();
  const isAdmin = canManageEmployees(ctx?.role ?? null);

  const filters: TeamListFilters = {
    search: sp?.q,
    role: (sp?.role === 'all' || !sp?.role ? 'all' : sp.role) as UserRole | 'all',
    skill: (sp?.skill === 'all' || !sp?.skill ? 'all' : sp.skill) as UserRole | 'all',
    availability:
      sp?.availability === 'all' || !sp?.availability
        ? 'all'
        : (sp.availability as TeamListFilters['availability']),
    account:
      sp?.account === 'active' || sp?.account === 'inactive'
        ? sp.account
        : 'all',
    archived:
      sp?.archived === 'include' || sp?.archived === 'only'
        ? sp.archived
        : 'exclude',
    overdueOnly: sp?.overdue === '1',
  };

  const rows = await listTeamMembersWithStats(filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Équipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestion des membres, rôles, charge et disponibilité — données Supabase.
          </p>
        </div>
        {isAdmin ? <NewTeamMemberDialog /> : null}
      </div>

      <TeamToolbar
        defaultQ={sp?.q}
        defaultRole={sp?.role ?? 'all'}
        defaultSkill={sp?.skill ?? 'all'}
        defaultAvailability={sp?.availability ?? 'all'}
        defaultAccount={sp?.account ?? 'all'}
        defaultArchived={sp?.archived ?? 'exclude'}
        defaultOverdue={sp?.overdue ?? ''}
      />

      <SectionCard title="Membres" description={`${rows.length} collaborateur(s)`}>
        {rows.length === 0 ? (
          <EmptyState title="Aucun résultat" description="Ajustez les filtres ou créez un membre." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="border-b border-border/80 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Collaborateur</th>
                  <th className="px-4 py-3 font-medium">Rôle principal</th>
                  <th className="px-4 py-3 font-medium">Compétences</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Dispo.</th>
                  <th className="px-4 py-3 font-medium">Charge</th>
                  <th className="px-4 py-3 font-medium">Cap.</th>
                  <th className="px-4 py-3 text-center font-medium">Tâches</th>
                  <th className="px-4 py-3 text-center font-medium">Retard</th>
                  <th className="px-4 py-3 text-center font-medium">Vidéos</th>
                  <th className="px-4 py-3 text-center font-medium">Projets</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((e) => (
                  <tr key={e.id} className="bg-card/40 transition-colors hover:bg-accent/30">
                    <td className="px-4 py-3">
                      <Link href={`/team/${e.id}`} className="flex items-center gap-3">
                        <UserAvatar
                          name={e.full_name}
                          initials={e.avatar_initials}
                          color={e.avatar_color}
                          size="sm"
                        />
                        <span className="font-medium text-foreground hover:text-primary">{e.full_name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-normal">
                        {ROLE_LABELS[e.role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {(e.operational_skills ?? []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          (e.operational_skills ?? []).map((s) => (
                            <Badge key={s} variant="outline" className="text-[10px] font-normal border-primary/30">
                              {ROLE_LABELS[s]}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {!e.is_active ? (
                          <Badge variant="outline" className="text-xs font-normal border-muted-foreground/40">
                            Inactif
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500/40 text-xs font-normal text-emerald-700 dark:text-emerald-400">
                            Actif
                          </Badge>
                        )}
                        {e.archived_at ? (
                          <Badge variant="destructive" className="text-xs font-normal">
                            Archivé
                          </Badge>
                        ) : null}
                        {!e.user_id ? (
                          <Badge variant="outline" className="border-amber-500/50 text-xs font-normal text-amber-800 dark:text-amber-200">
                            Auth non lié
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="block">{e.email}</span>
                      {e.phone ? <span className="text-xs">{e.phone}</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={
                          e.availability === 'overloaded'
                            ? 'border-destructive/60 font-normal text-destructive'
                            : 'font-normal'
                        }
                      >
                        {AVAIL_LABEL[e.availability]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{e.workload_percent}%</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{e.weekly_capacity}h</td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">{e.open_tasks}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-destructive">{e.overdue_tasks}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{e.videos_assigned}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {e.client_projects_led + e.internal_projects_owned}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <TeamMemberRowActions member={e} isAdmin={isAdmin} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
