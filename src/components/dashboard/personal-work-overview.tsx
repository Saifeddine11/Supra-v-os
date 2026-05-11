import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/ui/badge';
import { TASK_STATUS_MAP, PRIORITY_MAP, VIDEO_STATUS_MAP } from '@/types/domain';
import type { PersonalTaskRow, PersonalVideoRow } from '@/lib/data/dashboard-personal-work';
import { effectiveClientDeliveryIso } from '@/lib/videos/video-schedule';
import type { UserRole } from '@/types/database';
import { cn } from '@/lib/utils/cn';
import { getStatusBlockSurface } from '@/lib/ui/status-block-tone';

function roleLabel(role: UserRole | undefined): string {
  return role?.replace(/_/g, ' ') ?? '—';
}

export function PersonalWorkOverview({
  role,
  tasks,
  videos,
}: {
  role: UserRole;
  tasks: PersonalTaskRow[];
  videos: PersonalVideoRow[];
}) {
  const rk = role === 'designer' ? 'developer' : role;
  const showVideos = rk === 'editor' || rk === 'cameraman' || rk === 'community_manager';

  const tasksDueToday = tasks.filter((t) => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  });

  return (
    <div className="space-y-6">
      <SectionCard
        title="Mes priorités"
        description="Tâches qui vous sont assignées — les plus urgentes en échéance d’abord."
      >
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune tâche assignée pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li
                key={t.id}
                className={cn(
                  'flex flex-col gap-2 rounded-xl border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between',
                  getStatusBlockSurface('muted'),
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{t.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[t.clientName, t.projectTitle].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {TASK_STATUS_MAP[t.status].label}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {PRIORITY_MAP[t.priority].label}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  {t.deadline ? (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {format(new Date(t.deadline), 'd MMM yyyy', { locale: fr })}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sans date</span>
                  )}
                  <Link
                    href={`/tasks?highlight=${t.id}`}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Ouvrir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {showVideos ? (
        <SectionCard
          title="Mes vidéos"
          description={
            rk === 'cameraman'
              ? 'Productions où vous êtes en charge du tournage.'
              : rk === 'editor'
                ? 'Vidéos où vous êtes monteur et/ou caméraman (selon les assignations).'
                : 'Vidéos où vous intervenez (montage ou tournage).'
          }
        >
          {videos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {rk === 'cameraman'
                ? 'Aucun tournage ou vidéo assignée pour le moment.'
                : 'Aucune vidéo en cours sur votre nom pour le moment.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {videos.map((v) => (
                <li
                  key={v.id}
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between',
                    getStatusBlockSurface('neutral'),
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{v.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {v.clientName ?? '—'} ·{' '}
                      {v.role === 'both'
                        ? 'Monteur + Caméraman'
                        : v.role === 'cameraman'
                          ? 'Tournage'
                          : 'Montage'}
                    </p>
                    <Badge variant="outline" className="mt-2 text-[10px] font-normal">
                      {VIDEO_STATUS_MAP[v.status].label}
                    </Badge>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                    {effectiveClientDeliveryIso(v) ? (
                      <span className="text-xs text-muted-foreground">
                        Livraison client{' '}
                        {format(new Date(effectiveClientDeliveryIso(v)!), 'd MMM yyyy · HH:mm', { locale: fr })}
                      </span>
                    ) : null}
                    {v.shooting_date && (v.role === 'cameraman' || v.role === 'both') ? (
                      <span className="text-xs text-muted-foreground">
                        Tournage{' '}
                        {format(new Date(v.shooting_date), 'd MMM yyyy · HH:mm', { locale: fr })}
                      </span>
                    ) : null}
                    <Link href="/videos" className="text-xs font-semibold text-primary hover:underline">
                      Ouvrir
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Planning"
        description="Extractions rapides à partir de vos tâches et échéances."
      >
        <ul className="grid gap-3 text-sm sm:grid-cols-2">
          <li className={cn('rounded-lg p-3', getStatusBlockSurface('neutral'))}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tâches · aujourd’hui
            </p>
            <p className="mt-1 tabular-nums text-2xl font-semibold text-foreground">
              {tasksDueToday.length}
            </p>
            {tasksDueToday.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">Rien d’assigné à clôturer aujourd’hui.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {tasksDueToday.slice(0, 3).map((t) => (
                  <li key={t.id} className="truncate">
                    <Link href={`/tasks?highlight=${t.id}`} className="hover:text-primary hover:underline">
                      {t.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
          <li className={cn('rounded-lg p-3', getStatusBlockSurface('neutral'))}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rôle affiché
            </p>
            <p className="mt-1 capitalize text-foreground">{roleLabel(role)}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Les indicateurs en tête de page reflètent votre charge personnelle ; les journaux RH et techniques
              ne sont pas affichés ici.
            </p>
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}
