import { z } from 'zod';

export const AI_CONTEXT_TOOL_TYPES = [
  'searchTasks',
  'searchClients',
  'searchVideos',
  'getTodayPriorities',
  'getClientSummary',
  'getMyOperationalWork',
  'getScopedCalendarWork',
] as const;

export type AiContextToolType = (typeof AI_CONTEXT_TOOL_TYPES)[number];

export const aiContextRequestSchema = z.object({
  type: z.enum(AI_CONTEXT_TOOL_TYPES),
  query: z.string().trim().max(200).optional(),
  clientId: z.string().uuid('clientId invalide.').optional(),
  overdueOnly: z.boolean().optional(),
  focus: z.enum(['all', 'tasks', 'videos', 'shootings', 'priorities', 'overdue']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  periodLabel: z.string().trim().max(120).optional(),
  scopeMode: z.enum(['global', 'personal']).optional(),
  eventFocus: z.enum(['all', 'tasks', 'shootings', 'deliveries']).optional(),
});

export type AiContextRequest = z.infer<typeof aiContextRequestSchema>;

export type AiContextLink = {
  label: string;
  href: string;
  kind: 'task' | 'video' | 'client';
};

export type AiTaskContextItem = {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  priority: string;
  priorityLabel: string;
  deadline: string | null;
  clientName: string | null;
  assigneeNames: string | null;
  description: string | null;
  href: string;
  isOverdue?: boolean;
  isDueToday?: boolean;
};

export type AiClientContextItem = {
  id: string;
  name: string;
  status: string;
  statusLabel: string;
  accountManager: string | null;
  sector: string | null;
  city: string | null;
  activitySummary: string | null;
  href: string;
};

export type AiVideoContextItem = {
  id: string;
  title: string;
  clientName: string | null;
  productionStatus: string;
  shootingDate: string | null;
  deliveryDate: string | null;
  teamNames: string | null;
  roleOnVideo?: string | null;
  href: string;
};

export type AiMyOperationalWorkPayload = {
  scopeHint: 'assigned_only' | 'personal';
  employeeName: string;
  tasks: AiTaskContextItem[];
  videos: AiVideoContextItem[];
  overdueTasks: AiTaskContextItem[];
  dueTodayTasks: AiTaskContextItem[];
  shootingsToday: AiVideoContextItem[];
  deliveriesToday: AiVideoContextItem[];
};

export type AiCalendarShootingEvent = {
  videoId: string;
  title: string;
  clientName: string;
  at: string;
  teamNames: string | null;
  status: string;
  shootLabel?: string | null;
  href: string;
};

export type AiCalendarDeliveryEvent = {
  videoId: string;
  title: string;
  clientName: string;
  at: string;
  status: string;
  href: string;
};

export type AiScopedCalendarPayload = {
  scopeMode: 'global' | 'personal';
  periodLabel: string;
  startDate: string;
  endDate: string;
  tasks: AiTaskContextItem[];
  shootings: AiCalendarShootingEvent[];
  deliveries: AiCalendarDeliveryEvent[];
  watchItems: Array<{ label: string; detail: string; href: string }>;
};

export type AiTodayPrioritiesPayload = {
  scopeHint: 'team' | 'personal';
  overdueTasks: AiTaskContextItem[];
  dueTodayTasks: AiTaskContextItem[];
  shootingsToday: AiVideoContextItem[];
  deliveriesToday: AiVideoContextItem[];
  needingAttention: Array<{
    kind: 'task' | 'video';
    label: string;
    title: string;
    detail: string;
    href: string;
  }>;
};

export type AiClientSummaryPayload = {
  client: AiClientContextItem;
  activeTasks: AiTaskContextItem[];
  activeVideos: AiVideoContextItem[];
  nextDeadlines: Array<{ label: string; date: string; href: string }>;
  operationalNotes: string | null;
};

export type AiContextToolResult =
  | {
      ok: true;
      tool: AiContextToolType;
      empty: boolean;
      truncated: boolean;
      denied?: false;
      payload:
        | { tasks: AiTaskContextItem[] }
        | { clients: AiClientContextItem[] }
        | { videos: AiVideoContextItem[] }
        | { priorities: AiTodayPrioritiesPayload }
        | { summary: AiClientSummaryPayload }
        | { myWork: AiMyOperationalWorkPayload }
        | { calendar: AiScopedCalendarPayload };
      links: AiContextLink[];
    }
  | {
      ok: false;
      denied: true;
      reason: string;
    };

export const AI_CONTEXT_LIMITS = {
  tasks: 10,
  videos: 10,
  clients: 5,
  descriptionMax: 120,
} as const;
