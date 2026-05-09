import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTeamMemberDetail } from '@/lib/data/team';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageEmployees } from '@/lib/auth/capabilities';
import { ROLE_LABELS, TASK_STATUS_MAP, VIDEO_STATUS_MAP } from '@/types/domain';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/shared/section-card';
import { UserAvatar } from '@/components/shared/user-avatar';
import { EntityActivityFeed } from '@/components/activity/entity-activity-feed';
import { listActivityForEntity } from '@/lib/data/activity-logs';
import { EmployeeAdminForm } from '../employee-admin-form';
import { EmployeeRoleForm } from '../employee-role-form';
import { TeamMemberRowActions } from '../team-member-row-actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const m = await getTeamMemberDetail(id);
  return { title: m?.full_name ?? 'Collaborateur' };
}

const AVAIL_LABEL: Record<string, string> = {
  available: 'Disponible',
  busy: 'Occupé',
  overloaded: 'Surchargé',
  inactive: 'Inactif',
};

export default async function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [member, ctx, activity] = await Promise.all([
    getTeamMemberDetail(id),
    getAuthContext(),
    listActivityForEntity('employee', id, 40),
  ]);
  if (!member) notFound();

  const canAdmin = canManageEmployees(ctx?.role ?? null);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <UserAvatar
            name={member.full_name}
            initials={member.avatar_initials}
            color={member.avatar_color}
            size="lg"
          />
          <div className="min-w-0">
            <Link href="/team" className="text-xs font-medium text-primary hover:underline">
              ← Équipe
            </Link>
            <h1 className="mt-2 font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {member.full_name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Rôle principal</span>
              <Badge variant="outline">{ROLE_LABELS[member.role]}</Badge>
              <Badge variant="outline" className="font-normal">
                {AVAIL_LABEL[member.availability]}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Charge {member.workload_percent}% · {member.open_tasks} tâche(s) ouverte(s)
                {member.overdue_tasks > 0 ? (
                  <span className="text-destructive"> · {member.overdue_tasks} en retard</span>
                ) : null}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Compétences</span>
              {(member.operational_skills ?? []).length === 0 ? (
                <span className="text-xs text-muted-foreground">Aucune renseignée</span>
              ) : (
                (member.operational_skills ?? []).map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px] font-normal border-primary/30">
                    {ROLE_LABELS[s]}
                  </Badge>
                ))
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {member.is_active ? (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                  Compte actif
                </Badge>
              ) : (
                <Badge variant="outline" className="border-muted-foreground/40">
                  Compte inactif
                </Badge>
              )}
              {member.archived_at ? <Badge variant="destructive">Archivé</Badge> : null}
              {member.user_id ? (
                <Badge variant="outline" className="font-normal">
                  Auth lié
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/50 text-amber-800 dark:text-amber-200">
                  Auth non lié
                </Badge>
              )}
            </div>
          </div>
        </div>
        {canAdmin ? (
          <div className="shrink-0">
            <TeamMemberRowActions member={member} isAdmin />
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Profil" description="Coordonnées et capacité">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">E-mail</dt>
              <dd className="text-foreground">{member.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Téléphone</dt>
              <dd className="text-foreground">{member.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Capacité hebdomadaire</dt>
              <dd className="text-foreground">{member.weekly_capacity} h</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Mandats</dt>
              <dd className="text-muted-foreground">
                {member.client_projects_led} projet(s) client · {member.internal_projects_owned} interne(s)
              </dd>
            </div>
          </dl>
        </SectionCard>

        {canAdmin ? (
          <SectionCard title="Rôle et compétences" description="Réservé administrateur — rôle = permissions ; compétences = assignations">
            <EmployeeRoleForm
              employeeId={member.id}
              currentRole={member.role}
              operationalSkills={member.operational_skills ?? []}
            />
          </SectionCard>
        ) : (
          <SectionCard title="Rôle et compétences" description="Lecture seule">
            <p className="text-sm text-muted-foreground">
              Rôle principal : {ROLE_LABELS[member.role]}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Compétences :{' '}
              {(member.operational_skills ?? []).length
                ? (member.operational_skills ?? []).map((s) => ROLE_LABELS[s]).join(', ')
                : '—'}
            </p>
          </SectionCard>
        )}

        {canAdmin ? (
          <SectionCard title="Modifier la fiche" description="Champs sensibles — admin uniquement">
            <EmployeeAdminForm employee={member} />
          </SectionCard>
        ) : (
          <SectionCard title="Modifier la fiche" description="Seuls les administrateurs modifient ces données.">
            <p className="text-sm text-muted-foreground">Contactez un administrateur pour mettre à jour ce profil.</p>
          </SectionCard>
        )}
      </div>

      <SectionCard
        title="Tâches assignées"
        description={
          member.overdue_tasks > 0
            ? `Dont ${member.overdue_tasks} en retard — les plus récentes ci-dessous`
            : 'Les plus récentes'
        }
      >
        {member.recentTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune tâche ouverte.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
            {member.recentTasks.map((t) => (
              <li key={t.id} className="px-4 py-3 text-sm">
                <span className="font-medium text-foreground">{t.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">{TASK_STATUS_MAP[t.status].label}</span>
                {t.deadline &&
                new Date(t.deadline) < new Date() &&
                t.status !== 'done' &&
                t.status !== 'archived' ? (
                  <Badge variant="destructive" className="ml-2 text-[10px]">
                    Retard
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Vidéos — montage" description="Assigné comme monteur">
        {member.videosAsEditor.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune vidéo récente.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
            {member.videosAsEditor.map((v) => (
              <li key={v.id} className="px-4 py-3 text-sm">
                <span className="font-medium text-foreground">{v.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">{VIDEO_STATUS_MAP[v.status].label}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Vidéos — captation" description="Assigné comme cadreur">
        {member.videosAsCameraman.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune vidéo récente.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
            {member.videosAsCameraman.map((v) => (
              <li key={v.id} className="px-4 py-3 text-sm">
                <span className="font-medium text-foreground">{v.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">{VIDEO_STATUS_MAP[v.status].label}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Journal d’activité" description="Actions liées à ce collaborateur">
        <EntityActivityFeed logs={activity} />
      </SectionCard>
    </div>
  );
}
