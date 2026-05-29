import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffAiContext } from '@/lib/ai/require-staff-ai';
import { assertSupaiCapability } from '@/lib/ai/supai-permissions';
import {
  aiTaskUpdateDraftPayloadSchema,
  hasTaskUpdateChanges,
} from '@/lib/ai/task-update-draft-schema';
import { normalizeTaskUpdateDraft } from '@/lib/ai/normalize-task-update-draft';
import { SUPAI_REFUSAL_TASK_UPDATE } from '@/lib/ai/supai-copy';
import {
  previewClientResolution,
  previewAssigneeResolution,
} from '@/lib/tasks/resolve-task-references';
import { lookupTaskForUpdate } from '@/lib/tasks/resolve-task-for-update';
import { AI_TASK_PRIORITY_LABELS } from '@/lib/ai/task-draft-schema';
import { AI_TASK_UPDATE_STATUS_LABELS } from '@/lib/ai/task-update-draft-schema';
import { PRIORITY_MAP, TASK_STATUS_MAP } from '@/types/domain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  draft: aiTaskUpdateDraftPayloadSchema,
  selectedTaskId: z.string().uuid().optional(),
});

function formatDeadline(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

export async function POST(request: Request) {
  const auth = await requireStaffAiContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const deny = assertSupaiCapability(auth.ctx.supai, 'canUseSupAIUpdateTaskDraft');
  if (deny) {
    return NextResponse.json({ error: SUPAI_REFUSAL_TASK_UPDATE }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides.' }, { status: 400 });
  }

  const draft = normalizeTaskUpdateDraft(parsed.data.draft, '');
  const lookup = await lookupTaskForUpdate(auth.ctx, {
    taskId: parsed.data.selectedTaskId ?? draft.taskId,
    taskSearchText: parsed.data.selectedTaskId ? undefined : draft.taskSearchText,
  });

  let taskSnapshot: {
    id: string;
    title: string;
    clientName: string | null;
    assigneeName: string | null;
    deadline: string | null;
    deadlineLabel: string | null;
    status: string;
    statusLabel: string;
    priority: string;
    priorityLabel: string;
    description: string | null;
  } | null = null;

  let enrichedDraft = { ...draft };

  if (lookup.status === 'resolved') {
    const t = lookup.task;
    enrichedDraft = {
      ...draft,
      taskId: t.id,
      currentTitle: t.title,
    };
    taskSnapshot = {
      id: t.id,
      title: t.title,
      clientName: t.client_name,
      assigneeName: t.assignee_name,
      deadline: t.deadline,
      deadlineLabel: formatDeadline(t.deadline),
      status: t.status,
      statusLabel: TASK_STATUS_MAP[t.status]?.label ?? t.status,
      priority: t.priority,
      priorityLabel: PRIORITY_MAP[t.priority]?.label ?? t.priority,
      description: t.description,
    };
  }

  const clientPreview = draft.changes.clientName
    ? await previewClientResolution(auth.ctx, draft.changes.clientName)
    : { status: 'none' as const };
  const assigneePreview = draft.changes.assigneeName
    ? await previewAssigneeResolution(auth.ctx, draft.changes.assigneeName)
    : { status: 'none' as const };

  const changeRows: Array<{ field: string; oldValue: string; newValue: string }> = [];

  if (taskSnapshot && hasTaskUpdateChanges(draft.changes)) {
    const c = draft.changes;
    if (c.title) {
      changeRows.push({ field: 'Titre', oldValue: taskSnapshot.title, newValue: c.title });
    }
    if (c.description !== undefined) {
      changeRows.push({
        field: 'Description',
        oldValue: taskSnapshot.description ?? '—',
        newValue: c.description ?? '—',
      });
    }
    if (c.deadlineIso || c.deadlineText || c.clearDeadline) {
      changeRows.push({
        field: 'Échéance',
        oldValue: taskSnapshot.deadlineLabel ?? '—',
        newValue: c.clearDeadline
          ? 'Aucune'
          : formatDeadline(c.deadlineIso) ?? c.deadlineText ?? '—',
      });
    }
    if (c.priority) {
      changeRows.push({
        field: 'Priorité',
        oldValue: taskSnapshot.priorityLabel,
        newValue: AI_TASK_PRIORITY_LABELS[c.priority],
      });
    }
    if (c.status) {
      changeRows.push({
        field: 'Statut',
        oldValue: taskSnapshot.statusLabel,
        newValue: AI_TASK_UPDATE_STATUS_LABELS[c.status],
      });
    }
    if (c.clientName) {
      changeRows.push({
        field: 'Client',
        oldValue: taskSnapshot.clientName ?? '—',
        newValue: c.clientName,
      });
    }
    if (c.assigneeName) {
      changeRows.push({
        field: 'Assigné(s)',
        oldValue: taskSnapshot.assigneeName ?? '—',
        newValue: c.assigneeName,
      });
    }
  }

  return NextResponse.json({
    draft: enrichedDraft,
    lookup,
    taskSnapshot,
    changeRows,
    hasChanges: hasTaskUpdateChanges(draft.changes),
    client: clientPreview,
    assignee: assigneePreview,
  });
}
