/**
 * Kanban card color system:
 * - soft background = client brand tint
 * - left accent = workflow status (not overdue)
 * - overdue / priority = badges only
 */
import type { CSSProperties } from 'react';
import type { TaskStatus, VideoStatus } from '@/types/database';
import { TASK_STATUS_MAP, VIDEO_STATUS_MAP } from '@/types/domain';
import { getSoftBackgroundColor } from '@/lib/ui/client-colors';
import { cn } from '@/lib/utils/cn';

export function getTaskStatusAccentColor(status: TaskStatus): string {
  return TASK_STATUS_MAP[status]?.color ?? '#9CA3AF';
}

export function getVideoStatusAccentColor(status: VideoStatus): string {
  return VIDEO_STATUS_MAP[status]?.color ?? '#525252';
}

export function getKanbanClientCardVars(clientHex?: string | null): Record<string, string> {
  if (!clientHex) {
    return {
      '--kanban-client-tint': 'hsl(var(--card))',
      '--kanban-client-tint-dark': 'hsl(var(--card))',
      '--kanban-client-border': 'hsl(var(--border) / 0.45)',
    };
  }
  return {
    '--kanban-client-tint': getSoftBackgroundColor(clientHex, 0.11),
    '--kanban-client-tint-dark': getSoftBackgroundColor(clientHex, 0.07),
    '--kanban-client-border': getSoftBackgroundColor(clientHex, 0.2),
  };
}

export type KanbanCardPresentation = {
  className: string;
  style: CSSProperties;
};

/** Shared shell: client-tinted background + CSS var for status left accent. */
export function getKanbanCardPresentation(opts: {
  clientHex?: string | null;
  statusAccentHex: string;
}): KanbanCardPresentation {
  const hasClientTint = Boolean(opts.clientHex);
  return {
    className: cn(
      hasClientTint
        ? 'border-[color:var(--kanban-client-border)] bg-[var(--kanban-client-tint)] dark:bg-[var(--kanban-client-tint-dark)]'
        : 'border-border/50 bg-card',
    ),
    style: {
      ...getKanbanClientCardVars(opts.clientHex),
      '--kanban-status-accent': opts.statusAccentHex,
    } as CSSProperties,
  };
}

export const KANBAN_STATUS_ACCENT_CLASS =
  'pointer-events-none absolute bottom-2 left-0 top-2 z-[1] w-[3px] rounded-full opacity-90';

export function kanbanStatusAccentStyle(): CSSProperties {
  return { backgroundColor: 'var(--kanban-status-accent)' };
}

export const KANBAN_CARD_SHELL =
  'relative shrink-0 max-w-full overflow-hidden rounded-xl border shadow-sm';
