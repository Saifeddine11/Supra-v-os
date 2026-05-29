import type { TaskEnriched, TaskPriority, TaskStatus } from '@/types/database';
import { isTaskOverdueForAlert } from '@/lib/alerts/active-alert-rules';
import { getCalendarMobileTaskLabel } from '@/lib/tasks/calendar-mobile-label';

export type CalendarColorBy = 'status' | 'priority' | 'assignee' | 'client';

/** Accent visuel discret (bordure / point) — cohérent clair / sombre. */
export type CalendarTaskAccent = {
  border: string;
  dot: string;
  tint: string;
};

const ASSIGNEE_DOT = [
  'bg-blue-500 dark:bg-blue-400',
  'bg-teal-500 dark:bg-teal-400',
  'bg-cyan-500 dark:bg-cyan-400',
  'bg-indigo-500 dark:bg-indigo-400',
  'bg-rose-500 dark:bg-rose-400',
  'bg-fuchsia-500 dark:bg-fuchsia-400',
  'bg-sky-500 dark:bg-sky-400',
  'bg-emerald-500 dark:bg-emerald-400',
] as const;

export function assigneeAccentIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % ASSIGNEE_DOT.length;
}

export function calendarTaskOverdue(task: TaskEnriched): boolean {
  return isTaskOverdueForAlert({ status: task.status, deadline: task.deadline });
}

function statusAccent(status: TaskStatus, overdue: boolean): CalendarTaskAccent {
  if (overdue && status !== 'done') {
    return {
      border: 'border-l-red-600/90 dark:border-l-red-400/75',
      dot: 'bg-red-600 dark:bg-red-400',
      tint: 'bg-red-500/[0.06] dark:bg-red-500/[0.09]',
    };
  }
  switch (status) {
    case 'todo':
      return {
        border: 'border-l-muted-foreground/55 dark:border-l-muted-foreground/45',
        dot: 'bg-muted-foreground/70 dark:bg-muted-foreground/55',
        tint: 'bg-muted/50 dark:bg-muted/25',
      };
    case 'in_progress':
      return {
        border: 'border-l-blue-600/85 dark:border-l-blue-400/70',
        dot: 'bg-blue-600 dark:bg-blue-400',
        tint: 'bg-blue-500/[0.07] dark:bg-blue-500/[0.1]',
      };
    case 'waiting_client':
      return {
        border: 'border-l-amber-500/90 dark:border-l-amber-400/75',
        dot: 'bg-amber-500 dark:bg-amber-400',
        tint: 'bg-amber-500/[0.08] dark:bg-amber-500/[0.1]',
      };
    case 'waiting_team':
      return {
        border: 'border-l-orange-500/90 dark:border-l-orange-400/75',
        dot: 'bg-orange-500 dark:bg-orange-400',
        tint: 'bg-orange-500/[0.08] dark:bg-orange-500/[0.1]',
      };
    case 'review':
      return {
        border: 'border-l-violet-600/85 dark:border-l-violet-400/70',
        dot: 'bg-violet-600 dark:bg-violet-400',
        tint: 'bg-violet-500/[0.07] dark:bg-violet-500/[0.1]',
      };
    case 'blocked':
      return {
        border: 'border-l-red-600/90 dark:border-l-red-400/75',
        dot: 'bg-red-600 dark:bg-red-400',
        tint: 'bg-red-500/[0.07] dark:bg-red-500/[0.1]',
      };
    case 'done':
      return {
        border: 'border-l-emerald-600/85 dark:border-l-emerald-400/70',
        dot: 'bg-emerald-600 dark:bg-emerald-400',
        tint: 'bg-emerald-500/[0.07] dark:bg-emerald-500/[0.1]',
      };
    default:
      return {
        border: 'border-l-border dark:border-l-border',
        dot: 'bg-muted-foreground/50',
        tint: 'bg-muted/30',
      };
  }
}

function priorityAccent(priority: TaskPriority, overdue: boolean): CalendarTaskAccent {
  if (overdue) {
    return {
      border: 'border-l-red-600/90 dark:border-l-red-400/75',
      dot: 'bg-red-600 dark:bg-red-400',
      tint: 'bg-red-500/[0.07] dark:bg-red-500/[0.1]',
    };
  }
  switch (priority) {
    case 'low':
      return {
        border: 'border-l-muted-foreground/55 dark:border-l-muted-foreground/45',
        dot: 'bg-muted-foreground/65',
        tint: 'bg-muted/45 dark:bg-muted/20',
      };
    case 'normal':
      return {
        border: 'border-l-blue-600/85 dark:border-l-blue-400/70',
        dot: 'bg-blue-600 dark:bg-blue-400',
        tint: 'bg-blue-500/[0.07] dark:bg-blue-500/[0.1]',
      };
    case 'high':
      return {
        border: 'border-l-amber-600/85 dark:border-l-amber-400/70',
        dot: 'bg-amber-500 dark:bg-amber-400',
        tint: 'bg-amber-500/[0.08] dark:bg-amber-500/[0.1]',
      };
    case 'urgent':
      return {
        border: 'border-l-red-600/90 dark:border-l-red-400/75',
        dot: 'bg-red-600 dark:bg-red-400',
        tint: 'bg-red-500/[0.08] dark:bg-red-500/[0.11]',
      };
    default:
      return statusAccent('todo', false);
  }
}

function clientScopeAccent(task: TaskEnriched, overdue: boolean): CalendarTaskAccent {
  if (overdue && task.status !== 'done') {
    return {
      border: 'border-l-red-600/90 dark:border-l-red-400/75',
      dot: 'bg-red-600 dark:bg-red-400',
      tint: 'bg-red-500/[0.07] dark:bg-red-500/[0.1]',
    };
  }
  if (task.client_id) {
    return {
      border: 'border-l-blue-600/85 dark:border-l-blue-400/70',
      dot: 'bg-blue-600 dark:bg-blue-400',
      tint: 'bg-blue-500/[0.06] dark:bg-blue-500/[0.09]',
    };
  }
  if (task.internal_project_id) {
    return {
      border: 'border-l-primary/80 dark:border-l-primary/65',
      dot: 'bg-primary dark:bg-primary',
      tint: 'bg-primary/[0.08] dark:bg-primary/[0.12]',
    };
  }
  return {
    border: 'border-l-muted-foreground/45 dark:border-l-muted-foreground/35',
    dot: 'bg-muted-foreground/55',
    tint: 'bg-muted/40 dark:bg-muted/18',
  };
}

function assigneeAccent(task: TaskEnriched, overdue: boolean): CalendarTaskAccent {
  const accentId = task.assignees?.[0]?.id ?? task.assignee_id ?? '';
  if (!accentId) {
    return {
      border: 'border-l-muted-foreground/45',
      dot: 'bg-muted-foreground/45',
      tint: 'bg-muted/35',
    };
  }
  const i = assigneeAccentIndex(accentId);
  const dot = ASSIGNEE_DOT[i];
  const borders = [
    'border-l-blue-600/80 dark:border-l-blue-400/65',
    'border-l-teal-600/80 dark:border-l-teal-400/65',
    'border-l-cyan-600/80 dark:border-l-cyan-400/65',
    'border-l-indigo-600/80 dark:border-l-indigo-400/65',
    'border-l-rose-600/80 dark:border-l-rose-400/65',
    'border-l-fuchsia-600/80 dark:border-l-fuchsia-400/65',
    'border-l-sky-600/80 dark:border-l-sky-400/65',
    'border-l-emerald-600/80 dark:border-l-emerald-400/65',
  ] as const;
  if (overdue && task.status !== 'done') {
    return {
      border: 'border-l-red-600/90 dark:border-l-red-400/75',
      dot: 'bg-red-600 dark:bg-red-400',
      tint: 'bg-red-500/[0.07] dark:bg-red-500/[0.1]',
    };
  }
  return {
    border: borders[i],
    dot,
    tint: 'bg-card/80 dark:bg-card/60',
  };
}

/** Classes pour puce / carte selon « Colorer par ». */
export function getCalendarTaskTone(task: TaskEnriched, colorBy: CalendarColorBy): CalendarTaskAccent {
  const overdue = calendarTaskOverdue(task);
  switch (colorBy) {
    case 'priority':
      return priorityAccent(task.priority, overdue);
    case 'assignee':
      return assigneeAccent(task, overdue);
    case 'client':
      return clientScopeAccent(task, overdue);
    case 'status':
    default:
      return statusAccent(task.status, overdue);
  }
}

/** Libellé court pour grille mois (desktop : titre tronqué ; mobile : client / interne). */
export function getCalendarTaskLabel(task: TaskEnriched, compact: 'month-desktop' | 'month-mobile'): string {
  if (compact === 'month-mobile') return getCalendarMobileTaskLabel(task);
  const t = task.title?.trim() ?? '';
  if (t.length <= 42) return t;
  return `${t.slice(0, 40)}…`;
}

export function getCalendarColorByLabel(colorBy: CalendarColorBy): string {
  switch (colorBy) {
    case 'status':
      return 'Statut';
    case 'priority':
      return 'Priorité';
    case 'assignee':
      return 'Assigné';
    case 'client':
      return 'Client / projet';
    default:
      return 'Statut';
  }
}
