'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, Check, Loader2, Pencil, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';
import type { AiTaskDraftPayload } from '@/lib/ai/task-draft-schema';
import {
  AI_TASK_DRAFT_PRIORITY,
  AI_TASK_DRAFT_STATUS,
  AI_TASK_PRIORITY_LABELS,
  AI_TASK_STATUS_LABELS,
} from '@/lib/ai/task-draft-schema';
import { hrefTasksOpenDetail } from '@/lib/tasks/task-deep-link';
import {
  DRAFT_ASSIGNEE_NOT_FOUND,
  DRAFT_CLIENT_NOT_FOUND,
  DRAFT_VALUE_MISSING,
  DRAFT_VALUE_TO_CONFIRM,
  SUPAI_ERROR_NETWORK,
  SUPAI_ERROR_TASK_CREATE,
} from '@/lib/ai/supai-copy';
import { PRIORITY_MAP, TASK_STATUS_MAP } from '@/types/domain';

type TaskDraftCardProps = {
  draft: AiTaskDraftPayload;
  canCreate: boolean;
  onCancel: () => void;
  onTaskCreated?: (taskId: string) => void;
};

type FormOption = { id: string; name?: string; full_name?: string };

type DraftResolutionPreview = {
  client: {
    status: string;
    query?: string;
    label?: string;
    id?: string;
    matches?: Array<{ id: string; label: string }>;
  };
  assignee: {
    status: string;
    query?: string;
    label?: string;
    id?: string;
    matches?: Array<{ id: string; label: string }>;
  };
};

function toDatetimeLocal(iso?: string): string {
  if (!iso?.trim()) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function resolutionWarning(
  kind: 'client' | 'assignee',
  preview: DraftResolutionPreview['client'] | undefined,
  name: string,
  selectedId: string,
): string | null {
  if (!name.trim()) return null;
  if (selectedId) return null;
  if (!preview || preview.status === 'none') return null;
  if (preview.status === 'resolved') return null;
  if (preview.status === 'not_found') {
    return kind === 'client'
      ? `${DRAFT_CLIENT_NOT_FOUND} : ${name}`
      : `${DRAFT_ASSIGNEE_NOT_FOUND} : ${name}`;
  }
  if (preview.status === 'ambiguous') {
    const options = preview.matches?.map((m) => m.label).join(', ') ?? '';
    return kind === 'client'
      ? `Client ambigu : ${name} — choisissez dans la liste (${options}).`
      : `Assigné ambigu : ${name} — choisissez dans la liste (${options}).`;
  }
  return `${DRAFT_VALUE_TO_CONFIRM} : ${name}`;
}

export function TaskDraftCard({
  draft,
  canCreate,
  onCancel,
  onTaskCreated,
}: TaskDraftCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description ?? '');
  const [assigneeName, setAssigneeName] = useState(draft.assigneeName ?? '');
  const [clientName, setClientName] = useState(draft.clientName ?? '');
  const [clientId, setClientId] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(new Set());
  const [deadlineLocal, setDeadlineLocal] = useState(toDatetimeLocal(draft.deadlineIso));
  const [deadlineText, setDeadlineText] = useState(draft.deadlineText ?? '');
  const [priority, setPriority] = useState<(typeof AI_TASK_DRAFT_PRIORITY)[number]>(
    draft.priority ?? 'normal',
  );
  const [status, setStatus] = useState<(typeof AI_TASK_DRAFT_STATUS)[number]>(
    draft.status ?? 'todo',
  );

  const [clients, setClients] = useState<FormOption[]>([]);
  const [employees, setEmployees] = useState<FormOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [resolution, setResolution] = useState<DraftResolutionPreview | null>(null);
  const [resolutionLoading, setResolutionLoading] = useState(false);

  const sortedEmployees = useMemo(
    () =>
      [...employees].sort((a, b) =>
        (a.full_name ?? '').localeCompare(b.full_name ?? '', 'fr', { sensitivity: 'base' }),
      ),
    [employees],
  );

  useEffect(() => {
    setTitle(draft.title);
    setDescription(draft.description ?? '');
    setAssigneeName(draft.assigneeName ?? '');
    setClientName(draft.clientName ?? '');
    setClientId('');
    setAssigneeIds(new Set());
    setDeadlineLocal(toDatetimeLocal(draft.deadlineIso));
    setDeadlineText(draft.deadlineText ?? '');
    setPriority(draft.priority ?? 'normal');
    setStatus(draft.status ?? 'todo');
    setEditing(false);
    setCreatedId(null);
    setResolution(null);
  }, [draft]);

  useEffect(() => {
    if (!canCreate) return;
    setOptionsLoading(true);
    void fetch('/api/ai/actions/task-form-options', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data: { clients?: FormOption[]; employees?: FormOption[] }) => {
        setClients(data.clients ?? []);
        setEmployees(data.employees ?? []);
      })
      .catch(() => {
        setClients([]);
        setEmployees([]);
      })
      .finally(() => setOptionsLoading(false));
  }, [canCreate]);

  useEffect(() => {
    if (!canCreate) return;
    const client = clientName.trim();
    const assignee = assigneeName.trim();
    if (!client && !assignee) {
      setResolution(null);
      return;
    }

    const timer = setTimeout(() => {
      setResolutionLoading(true);
      void fetch('/api/ai/actions/resolve-task-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          clientName: client || undefined,
          assigneeName: assignee || undefined,
        }),
      })
        .then((res) => res.json())
        .then((data: DraftResolutionPreview) => {
          setResolution(data);
          if (data.client.status === 'resolved' && 'id' in data.client && data.client.id) {
            setClientId(data.client.id);
          }
          if (data.assignee.status === 'resolved' && 'id' in data.assignee && data.assignee.id) {
            setAssigneeIds(new Set([data.assignee.id]));
          }
        })
        .catch(() => setResolution(null))
        .finally(() => setResolutionLoading(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [canCreate, clientName, assigneeName]);

  const selectedClientLabel =
    clients.find((c) => c.id === clientId)?.name ??
    (resolution?.client.status === 'resolved' ? resolution.client.label : clientName);

  const selectedAssigneeLabels =
    assigneeIds.size > 0
      ? [...assigneeIds]
          .map((id) => employees.find((e) => e.id === id)?.full_name ?? id)
          .join(', ')
      : resolution?.assignee.status === 'resolved'
        ? resolution.assignee.label
        : assigneeName;

  const clientWarning = resolutionWarning('client', resolution?.client, clientName, clientId);
  const assigneeWarning = resolutionWarning(
    'assignee',
    resolution?.assignee,
    assigneeName,
    assigneeIds.size > 0 ? [...assigneeIds][0] : '',
  );
  const hasBlockingWarning = Boolean(clientWarning || assigneeWarning);

  async function handleConfirm() {
    if (!canCreate || confirming || hasBlockingWarning) return;
    if (!title.trim()) {
      toast.error('Le titre est requis.');
      return;
    }

    setConfirming(true);
    try {
      const deadline = fromDatetimeLocal(deadlineLocal) ?? draft.deadlineIso;
      const res = await fetch('/api/ai/actions/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          clientId: clientId || undefined,
          clientName: clientId ? undefined : clientName.trim() || undefined,
          assigneeIds: assigneeIds.size ? [...assigneeIds] : undefined,
          assigneeName:
            assigneeIds.size > 0 ? undefined : assigneeName.trim() || undefined,
          deadline,
          deadlineText: deadlineText.trim() || undefined,
          priority,
          status,
        }),
      });
      const data = (await res.json()) as { taskId?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? SUPAI_ERROR_TASK_CREATE);
        return;
      }
      if (data.taskId) {
        setCreatedId(data.taskId);
        onTaskCreated?.(data.taskId);
        toast.success('Tâche créée');
      }
    } catch {
      toast.error(SUPAI_ERROR_NETWORK);
    } finally {
      setConfirming(false);
    }
  }

  if (createdId) {
    return (
      <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
        <p className="font-medium text-foreground">Tâche créée</p>
        <p className="mt-1 text-muted-foreground">{title}</p>
        <Button asChild variant="outline" size="sm" className="mt-3 rounded-full">
          <Link href={hrefTasksOpenDetail(createdId)}>Voir la tâche</Link>
        </Button>
      </div>
    );
  }

  const selectClass =
    'h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground';

  return (
    <div className="mt-2 rounded-xl border border-border/70 bg-card p-4 text-sm shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Brouillon de tâche
      </p>

      {editing ? (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="draft-title">Titre</Label>
            <Input
              id="draft-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              className="rounded-lg"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="draft-desc">Description</Label>
            <Textarea
              id="draft-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              className="resize-none rounded-lg"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="draft-client">Client</Label>
            <select
              id="draft-client"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                const picked = clients.find((c) => c.id === e.target.value);
                if (picked?.name) setClientName(picked.name);
              }}
              className={selectClass}
              disabled={optionsLoading}
            >
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label>Assignés</Label>
              <span className="text-xs text-muted-foreground">
                {assigneeIds.size === 0 ? 'Non assigné' : `${assigneeIds.size} personne(s)`}
              </span>
            </div>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border/70 bg-muted/20 p-3">
              {sortedEmployees.map((e) => (
                <label
                  key={e.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted/60"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-border accent-primary"
                    checked={assigneeIds.has(e.id)}
                    onChange={(ev) => {
                      setAssigneeIds((prev) => {
                        const next = new Set(prev);
                        if (ev.target.checked) next.add(e.id);
                        else next.delete(e.id);
                        return next;
                      });
                      if (ev.target.checked && e.full_name) setAssigneeName(e.full_name);
                    }}
                  />
                  <span className="min-w-0 truncate">{e.full_name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="draft-status">Statut</Label>
              <select
                id="draft-status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as (typeof AI_TASK_DRAFT_STATUS)[number])
                }
                className={selectClass}
              >
                {AI_TASK_DRAFT_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_MAP[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-priority">Priorité</Label>
              <select
                id="draft-priority"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as (typeof AI_TASK_DRAFT_PRIORITY)[number])
                }
                className={selectClass}
              >
                {AI_TASK_DRAFT_PRIORITY.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_MAP[p].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="draft-deadline">Échéance</Label>
            <Input
              id="draft-deadline"
              type="datetime-local"
              value={deadlineLocal}
              onChange={(e) => setDeadlineLocal(e.target.value)}
              className="rounded-lg"
            />
          </div>
        </div>
      ) : (
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Titre</dt>
            <dd className="font-medium">{title}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Description</dt>
            <dd className="whitespace-pre-wrap text-foreground/90">
              {description.trim() ? description : DRAFT_VALUE_MISSING}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Client</dt>
            <dd>{selectedClientLabel?.trim() ? selectedClientLabel : DRAFT_VALUE_MISSING}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Assigné(s)</dt>
            <dd className="flex items-center gap-1.5">
              {selectedAssigneeLabels?.trim() ? (
                <>
                  <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <span>{selectedAssigneeLabels}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{DRAFT_VALUE_MISSING}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Échéance</dt>
            <dd className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {deadlineText || deadlineLocal.replace('T', ' ') || (
                <span className="text-muted-foreground">{DRAFT_VALUE_MISSING}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Priorité</dt>
            <dd>{AI_TASK_PRIORITY_LABELS[priority]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Statut</dt>
            <dd>{AI_TASK_STATUS_LABELS[status]}</dd>
          </div>
        </dl>
      )}

      {resolutionLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">Vérification client / assigné…</p>
      ) : null}

      {clientWarning ? (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          {clientWarning}
        </p>
      ) : null}

      {assigneeWarning ? (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          {assigneeWarning}
        </p>
      ) : null}

      {!canCreate ? (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          Votre rôle ne permet pas de créer des tâches via SupAI.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canCreate ? (
          <>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="rounded-full"
              disabled={confirming || hasBlockingWarning}
              onClick={() => void handleConfirm()}
            >
              {confirming ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Confirmer la tâche
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={confirming}
              onClick={() => setEditing((v) => !v)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {editing ? 'Aperçu' : 'Modifier'}
            </Button>
          </>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('rounded-full', !canCreate && 'ml-0')}
          disabled={confirming}
          onClick={onCancel}
        >
          <X className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Annuler
        </Button>
      </div>
    </div>
  );
}
