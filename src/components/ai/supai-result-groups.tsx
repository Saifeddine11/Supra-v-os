'use client';

import Link from 'next/link';
import { Calendar, ClipboardList, Sparkles, Truck, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type {
  SupaiDeliveryResultItem,
  SupaiResultGroup,
  SupaiShootingResultItem,
  SupaiTaskResultItem,
  SupaiVideoResultItem,
  SupaiWatchResultItem,
} from '@/lib/ai/result-groups-schema';

type Accent = 'task' | 'video' | 'shooting' | 'delivery' | 'watch';

const ACCENT_STYLES: Record<Accent, string> = {
  task: 'border-l-indigo-500/70',
  video: 'border-l-violet-500/60',
  shooting: 'border-l-orange-500/80',
  delivery: 'border-l-emerald-500/70',
  watch: 'border-l-destructive/70',
};

function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function ResultCardShell({
  accent,
  title,
  children,
  action,
}: {
  accent: Accent;
  title: string;
  children: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        'rounded-xl border border-border/70 bg-card/95 p-3.5 shadow-sm',
        'border-l-[3px]',
        ACCENT_STYLES[accent],
      )}
    >
      <h4 className="text-sm font-semibold leading-snug text-foreground">{title}</h4>
      <div className="mt-2.5 space-y-2">{children}</div>
      <div className="mt-3">{action}</div>
    </article>
  );
}

function ClientBadge({ name }: { name?: string | null }) {
  if (!name?.trim()) return null;
  return (
    <Badge variant="outline" className="max-w-full truncate text-[11px] font-normal">
      {name}
    </Badge>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" size="sm" className="h-8 w-full rounded-full text-xs sm:w-auto">
      <Link href={href}>{label}</Link>
    </Button>
  );
}

export function SupAITaskResultCard({ item }: { item: SupaiTaskResultItem }) {
  const deadline = formatDateTime(item.deadline);
  return (
    <ResultCardShell
      accent="task"
      title={item.title}
      action={<ActionLink href={item.href} label="Voir la tâche" />}
    >
      <div className="flex flex-wrap gap-1.5">
        <ClientBadge name={item.clientName} />
        <Badge variant="outline" className="text-[11px] font-normal">
          {item.status}
        </Badge>
        {item.priority ? (
          <Badge variant="primary" className="text-[11px] font-normal">
            {item.priority}
          </Badge>
        ) : null}
        {item.isOverdue ? (
          <Badge variant="destructive" className="text-[11px] font-normal">
            En retard
          </Badge>
        ) : null}
      </div>
      {item.assigneeNames ? (
        <p className="text-xs text-muted-foreground">Assigné(s) : {item.assigneeNames}</p>
      ) : null}
      {deadline ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Échéance · {deadline}
        </p>
      ) : null}
    </ResultCardShell>
  );
}

export function SupAIVideoResultCard({ item }: { item: SupaiVideoResultItem }) {
  const shooting = formatDateOnly(item.shootingDate);
  const delivery = formatDateOnly(item.deliveryDate);
  const team = item.teamNames?.length
    ? item.teamNames.join(', ')
    : [item.editorNames, item.cameramanNames].filter(Boolean).join(', ') || null;

  return (
    <ResultCardShell
      accent="video"
      title={item.title}
      action={<ActionLink href={item.href} label="Voir la vidéo" />}
    >
      <div className="flex flex-wrap gap-1.5">
        <ClientBadge name={item.clientName} />
        <Badge variant="outline" className="text-[11px] font-normal">
          {item.productionStatus}
        </Badge>
      </div>
      {shooting ? (
        <p className="text-xs text-muted-foreground">Tournage · {shooting}</p>
      ) : null}
      {delivery ? (
        <p className="text-xs text-muted-foreground">Livraison · {delivery}</p>
      ) : null}
      {team ? <p className="text-xs text-muted-foreground">Équipe · {team}</p> : null}
    </ResultCardShell>
  );
}

export function SupAIShootingResultCard({ item }: { item: SupaiShootingResultItem }) {
  const when = formatDateTime(item.date ?? item.shootingDate);
  const team = item.teamNames?.length
    ? item.teamNames.join(', ')
    : item.cameramanNames ?? null;

  return (
    <ResultCardShell
      accent="shooting"
      title={item.title}
      action={<ActionLink href={item.href} label="Voir la vidéo" />}
    >
      <div className="flex flex-wrap gap-1.5">
        <ClientBadge name={item.clientName} />
        {when ? (
          <Badge variant="warning" className="text-[11px] font-normal">
            {when}
          </Badge>
        ) : null}
        <Badge variant="outline" className="text-[11px] font-normal">
          {item.productionStatus}
        </Badge>
      </div>
      {team ? <p className="text-xs text-muted-foreground">Équipe · {team}</p> : null}
    </ResultCardShell>
  );
}

export function SupAIDeliveryResultCard({ item }: { item: SupaiDeliveryResultItem }) {
  const when = formatDateTime(item.date ?? item.deliveryDate);

  return (
    <ResultCardShell
      accent="delivery"
      title={item.title}
      action={<ActionLink href={item.href} label="Voir la vidéo" />}
    >
      <div className="flex flex-wrap gap-1.5">
        <ClientBadge name={item.clientName} />
        {when ? (
          <Badge variant="success" className="text-[11px] font-normal">
            Livraison · {when}
          </Badge>
        ) : null}
        <Badge variant="outline" className="text-[11px] font-normal">
          {item.productionStatus}
        </Badge>
      </div>
    </ResultCardShell>
  );
}

function SupAIWatchResultCard({ item }: { item: SupaiWatchResultItem }) {
  const href = item.href;
  const isTask = href.includes('/tasks');
  return (
    <ResultCardShell
      accent="watch"
      title={item.title}
      action={
        <ActionLink
          href={href}
          label={isTask ? 'Voir la tâche' : 'Voir la vidéo'}
        />
      }
    >
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive/80" aria-hidden />
        {item.detail}
      </p>
    </ResultCardShell>
  );
}

function groupIcon(type: SupaiResultGroup['type']) {
  if (type === 'task_results') return ClipboardList;
  if (type === 'shooting_results') return Calendar;
  if (type === 'delivery_results') return Truck;
  if (type === 'watch_results') return AlertTriangle;
  return Sparkles;
}

export function SupAIResultGroups({ groups }: { groups: SupaiResultGroup[] }) {
  if (!groups.length) return null;

  return (
    <div className="mt-3 space-y-4">
      {groups.map((group) => {
        const Icon = groupIcon(group.type);
        return (
          <section key={`${group.type}-${group.title}`} className="space-y-2.5">
            <div className="flex items-center gap-2 px-0.5">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </h3>
            </div>
            <div className="grid gap-2.5">
              {group.type === 'task_results'
                ? group.items.map((item) => <SupAITaskResultCard key={item.id} item={item} />)
                : null}
              {group.type === 'video_results'
                ? group.items.map((item) => <SupAIVideoResultCard key={item.id} item={item} />)
                : null}
              {group.type === 'shooting_results'
                ? group.items.map((item) => (
                    <SupAIShootingResultCard key={item.id} item={item} />
                  ))
                : null}
              {group.type === 'delivery_results'
                ? group.items.map((item) => (
                    <SupAIDeliveryResultCard key={item.id} item={item} />
                  ))
                : null}
              {group.type === 'watch_results'
                ? group.items.map((item) => (
                    <SupAIWatchResultCard key={item.id} item={item} />
                  ))
                : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
