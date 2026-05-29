import 'server-only';

import type { AuthContext } from '@/lib/auth/permissions';
import { hasFullOrgDataAccess, taskListingDenied } from '@/lib/auth/data-scope';
import { getPersonalDashboardWork } from '@/lib/data/dashboard-personal-work';
import { listTasksEnriched } from '@/lib/data/tasks';
import { listVideosWithClients } from '@/lib/data/videos';
import {
  listCalendarVideoEvents,
  type CalendarVideoEvent,
} from '@/lib/data/videos-calendar';
import {
  isTaskDueTodayForAlert,
  isTaskOverdueForAlert,
} from '@/lib/alerts/active-alert-rules';
import { taskDeadlineInRange } from '@/lib/dates/parse-ai-date-range';
import { hrefTasksOpenDetail } from '@/lib/tasks/task-deep-link';
import { hrefVideosOpenDetailKanban } from '@/lib/videos/video-deep-link';
import { videoStaffProductionStatusLabel } from '@/lib/videos/video-staff-status';
import { TASK_STATUS_MAP, PRIORITY_MAP } from '@/types/domain';
import type { TaskEnriched } from '@/types/database';
import type {
  AiScopedCalendarPayload,
  AiTaskContextItem,
} from '@/lib/ai/context-schema';
import type { CalendarEventFocus, CalendarScopeMode } from '@/lib/ai/calendar-intent';

const CALENDAR_TASK_LIMIT = 30;
const CALENDAR_VIDEO_LIMIT = 25;

function taskStatusLabel(status: string): string {
  return TASK_STATUS_MAP[status as keyof typeof TASK_STATUS_MAP]?.label ?? status;
}

function priorityLabel(priority: string): string {
  return PRIORITY_MAP[priority as keyof typeof PRIORITY_MAP]?.label ?? priority;
}

function mapTask(t: TaskEnriched, now: Date): AiTaskContextItem {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    statusLabel: taskStatusLabel(t.status),
    priority: t.priority,
    priorityLabel: priorityLabel(t.priority),
    deadline: t.deadline,
    clientName: t.client_name,
    assigneeNames: t.assignee_name,
    description: null,
    href: hrefTasksOpenDetail(t.id),
    isOverdue: isTaskOverdueForAlert({ status: t.status, deadline: t.deadline, now }),
    isDueToday: isTaskDueTodayForAlert({ status: t.status, deadline: t.deadline, now }),
  };
}

function mapPersonalTask(
  row: Awaited<ReturnType<typeof getPersonalDashboardWork>>['tasks'][number],
  now: Date,
): AiTaskContextItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    statusLabel: taskStatusLabel(row.status),
    priority: row.priority,
    priorityLabel: priorityLabel(row.priority),
    deadline: row.deadline,
    clientName: row.clientName,
    assigneeNames: null,
    description: null,
    href: hrefTasksOpenDetail(row.id),
    isOverdue: isTaskOverdueForAlert({ status: row.status, deadline: row.deadline, now }),
    isDueToday: isTaskDueTodayForAlert({ status: row.status, deadline: row.deadline, now }),
  };
}

function videoRolesWithCalendarAccess(role: AuthContext['role']): boolean {
  if (!role) return false;
  return role === 'editor' || role === 'cameraman' || role === 'community_manager';
}

async function fetchTasksInRange(
  ctx: AuthContext,
  start: Date,
  end: Date,
  scopeMode: CalendarScopeMode,
  now: Date,
): Promise<AiTaskContextItem[]> {
  if (scopeMode === 'global' && !taskListingDenied(ctx)) {
    const tasks = await listTasksEnriched(
      {
        deadlineFrom: start.toISOString(),
        deadlineTo: end.toISOString(),
      },
      ctx,
    );
    return tasks.slice(0, CALENDAR_TASK_LIMIT).map((t) => mapTask(t, now));
  }

  const employeeId = ctx.employee?.id;
  const role = ctx.role;
  if (!employeeId || !role) return [];

  const personal = await getPersonalDashboardWork(employeeId, role);
  return personal.tasks
    .filter((t) => taskDeadlineInRange(t.deadline, start, end))
    .slice(0, CALENDAR_TASK_LIMIT)
    .map((t) => mapPersonalTask(t, now));
}

async function fetchVideoEventsInRange(
  ctx: AuthContext,
  start: Date,
  end: Date,
  scopeMode: CalendarScopeMode,
): Promise<CalendarVideoEvent[]> {
  if (!ctx.role) return [];

  if (scopeMode === 'personal') {
    if (!videoRolesWithCalendarAccess(ctx.role)) return [];
  } else if (!hasFullOrgDataAccess(ctx)) {
    return [];
  }

  const events = await listCalendarVideoEvents(ctx, start, end);
  return events.slice(0, CALENDAR_VIDEO_LIMIT * 2);
}

function buildWatchItems(tasks: AiTaskContextItem[]): AiScopedCalendarPayload['watchItems'] {
  const items: AiScopedCalendarPayload['watchItems'] = [];
  for (const task of tasks) {
    if (task.isOverdue) {
      items.push({
        label: task.title,
        detail: `Tâche en retard — ${task.clientName ?? 'sans client'}`,
        href: task.href,
      });
      continue;
    }
    if (task.priority === 'urgent' || task.status === 'blocked') {
      items.push({
        label: task.title,
        detail:
          task.status === 'blocked'
            ? `Tâche bloquée — ${task.statusLabel}`
            : `Priorité ${task.priorityLabel}`,
        href: task.href,
      });
    }
  }
  return items.slice(0, 8);
}

export type ScopedCalendarWorkInput = {
  startDate: Date;
  endDate: Date;
  periodLabel: string;
  scopeMode: CalendarScopeMode;
  eventFocus?: CalendarEventFocus;
};

export async function getScopedCalendarWork(
  ctx: AuthContext,
  input: ScopedCalendarWorkInput,
): Promise<AiScopedCalendarPayload> {
  const { startDate, endDate, periodLabel, scopeMode, eventFocus = 'all' } = input;
  const now = new Date();

  let tasks: AiTaskContextItem[] = [];
  if (eventFocus === 'all' || eventFocus === 'tasks') {
    tasks = await fetchTasksInRange(ctx, startDate, endDate, scopeMode, now);
  }

  const videoEvents = await fetchVideoEventsInRange(ctx, startDate, endDate, scopeMode);
  const teamByVideo = new Map<string, string>();

  if (scopeMode === 'global' && videoEvents.length) {
    const videos = await listVideosWithClients(ctx);
    for (const v of videos) {
      const team = [v.editor_name, v.cameraman_name].filter(Boolean).join(' · ');
      if (team) teamByVideo.set(v.id, team);
    }
  }

  let shootings = videoEvents
    .filter((e) => e.kind === 'shoot')
    .slice(0, CALENDAR_VIDEO_LIMIT)
    .map((e) => ({
      videoId: e.videoId,
      title: e.title,
      clientName: e.clientName,
      at: e.at,
      teamNames: teamByVideo.get(e.videoId) ?? null,
      status: videoStaffProductionStatusLabel(e.status),
      shootLabel: e.shootLabel ?? null,
      href: hrefVideosOpenDetailKanban(e.videoId),
    }));

  let deliveries = videoEvents
    .filter((e) => e.kind === 'delivery')
    .slice(0, CALENDAR_VIDEO_LIMIT)
    .map((e) => ({
      videoId: e.videoId,
      title: e.title,
      clientName: e.clientName,
      at: e.at,
      status: videoStaffProductionStatusLabel(e.status),
      href: hrefVideosOpenDetailKanban(e.videoId),
    }));

  if (eventFocus === 'shootings') {
    tasks = [];
    deliveries = [];
  } else if (eventFocus === 'deliveries') {
    tasks = [];
    shootings = [];
  } else if (eventFocus === 'tasks') {
    shootings = [];
    deliveries = [];
  }

  return {
    scopeMode,
    periodLabel,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    tasks,
    shootings,
    deliveries,
    watchItems: buildWatchItems(tasks),
  };
}

export function isScopedCalendarEmpty(payload: AiScopedCalendarPayload): boolean {
  return (
    payload.tasks.length === 0 &&
    payload.shootings.length === 0 &&
    payload.deliveries.length === 0 &&
    payload.watchItems.length === 0
  );
}
