'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';
import type { AiTaskUpdateDraftPayload } from '@/lib/ai/task-update-draft-schema';
import {
  AI_TASK_DRAFT_PRIORITY,
  AI_TASK_PRIORITY_LABELS,
} from '@/lib/ai/task-draft-schema';
import {
  AI_TASK_UPDATE_STATUS,
  AI_TASK_UPDATE_STATUS_LABELS,
  hasTaskUpdateChanges,
  TASK_UPDATE_DRAFT_EMPTY_CHANGES,
  TASK_UPDATE_DRAFT_NOT_FOUND,
} from '@/lib/ai/task-update-draft-schema';
import {
  SUPAI_ERROR_NETWORK,
  SUPAI_REFUSAL_TASK_UPDATE,
} from '@/lib/ai/supai-copy';
import {
  draftReferenceBlockingWarning,
  draftReferenceBlocksConfirm,
  draftReferenceResolvedHint,
  type DraftReferencePreview,
} from '@/lib/ai/draft-resolution-ui';
import {
  DraftReferenceAmbiguousPicker,
  DraftReferenceResolvedHint,
} from '@/components/ai/draft-name-resolution';
import { hrefTasksOpenDetail } from '@/lib/tasks/task-deep-link';
import {
  getOperationalDatetimeSubmitError,
  OperationalDatetimeField,
} from '@/components/shared/operational-datetime-field';

type TaskUpdateDraftCardProps = {
  draft: AiTaskUpdateDraftPayload;
  canUpdate: boolean;
  onCancel: () => void;
  onTaskUpdated?: (taskId: string) => void;
};

type ChangeRow = { field: string; oldValue: string; newValue: string };

type TaskSnapshot = {
  id: string;
  title: string;
  clientName: string | null;
  assigneeName: string | null;
  deadlineLabel: string | null;
  statusLabel: string;
  priorityLabel: string;
  description: string | null;
};

type LookupMatch = {
  id: string;
  title: string;
  clientName: string | null;
  assigneeName: string | null;
};

type ResolveResponse = {
  draft: AiTaskUpdateDraftPayload;
  lookup: {
    status: 'resolved' | 'not_found' | 'ambiguous';
    query?: string;
    matches?: LookupMatch[];
  };
  taskSnapshot: TaskSnapshot | null;
  changeRows: ChangeRow[];
  hasChanges: boolean;
  client?: DraftReferencePreview;
  assignee?: DraftReferencePreview;
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

export function TaskUpdateDraftCard({
  draft,
  canUpdate,
  onCancel,
  onTaskUpdated,
}: TaskUpdateDraftCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [updatedId, setUpdatedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState<ResolveResponse | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(draft.taskId);

  const [localDraft, setLocalDraft] = useState(draft);
  const [resolvedClientId, setResolvedClientId] = useState('');
  const [resolvedAssigneeIds, setResolvedAssigneeIds] = useState<string[]>([]);

  useEffect(() => {
    setLocalDraft(draft);
    setSelectedTaskId(draft.taskId);
    setUpdatedId(null);
    setEditing(false);
    setResolvedClientId('');
    setResolvedAssigneeIds([]);
  }, [draft]);

  const loadResolution = useCallback(async (taskId?: string) => {
    if (!canUpdate) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/ai/actions/resolve-task-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ draft: localDraft, selectedTaskId: taskId }),
      });
      const data = (await res.json()) as ResolveResponse & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? SUPAI_REFUSAL_TASK_UPDATE);
        setResolved(null);
        return;
      }
      setResolved(data);
      if (data.draft.taskId) setSelectedTaskId(data.draft.taskId);
      if (data.client?.status === 'resolved' && data.client.id) {
        setResolvedClientId(data.client.id);
      } else if (!localDraft.changes.clientName) {
        setResolvedClientId('');
      }
      if (data.assignee?.status === 'resolved' && data.assignee.id) {
        setResolvedAssigneeIds([data.assignee.id]);
      } else if (!localDraft.changes.assigneeName) {
        setResolvedAssigneeIds([]);
      }
    } catch {
      toast.error(SUPAI_ERROR_NETWORK);
      setResolved(null);
    } finally {
      setLoading(false);
    }
  }, [canUpdate, localDraft]);

  useEffect(() => {
    void loadResolution(selectedTaskId);
  }, [loadResolution, selectedTaskId]);

  const taskId = resolved?.taskSnapshot?.id ?? selectedTaskId ?? localDraft.taskId;
  const lookupStatus = resolved?.lookup.status;
  const ambiguousMatches = resolved?.lookup.matches ?? [];
  const changeRows = resolved?.changeRows ?? [];
  const hasChanges = resolved?.hasChanges ?? hasTaskUpdateChanges(localDraft.changes);
  const clientName = localDraft.changes.clientName ?? '';
  const assigneeName = localDraft.changes.assigneeName ?? '';
  const clientPreview = resolved?.client;
  const assigneePreview = resolved?.assignee;
  const clientWarning = draftReferenceBlockingWarning(
    'client',
    clientPreview,
    clientName,
    resolvedClientId,
  );
  const assigneeWarning = draftReferenceBlockingWarning(
    'assignee',
    assigneePreview,
    assigneeName,
    resolvedAssigneeIds[0] ?? '',
  );
  const clientResolvedHint = draftReferenceResolvedHint(clientPreview, clientName);
  const assigneeResolvedHint = draftReferenceResolvedHint(assigneePreview, assigneeName);
  const referenceBlocksConfirm =
    draftReferenceBlocksConfirm(clientPreview, clientName, resolvedClientId) ||
    draftReferenceBlocksConfirm(assigneePreview, assigneeName, resolvedAssigneeIds[0] ?? '');

  const canConfirm =
    canUpdate &&
    Boolean(taskId) &&
    lookupStatus === 'resolved' &&
    hasChanges &&
    !referenceBlocksConfirm &&
    !confirming &&
    !loading;

  async function handleConfirm() {
    if (!canConfirm || !taskId) return;
    if (localDraft.changes.deadlineIso && !localDraft.changes.clearDeadline) {
      const local = toDatetimeLocal(localDraft.changes.deadlineIso);
      const deadlineErr = getOperationalDatetimeSubmitError(local);
      if (deadlineErr) {
        toast.error(deadlineErr);
        return;
      }
    }
    setConfirming(true);
    try {
      const c = localDraft.changes;
      const payload: Record<string, unknown> = { taskId };
      const changes: Record<string, unknown> = {};

      if (c.title) changes.title = c.title;
      if (c.description !== undefined) changes.description = c.description;
      if (c.clearDeadline) changes.deadline = null;
      else if (c.deadlineIso) changes.deadline = c.deadlineIso;
      if (c.priority) changes.priority = c.priority;
      if (c.status) changes.status = c.status;
      if (c.clientName) {
        if (resolvedClientId) changes.clientId = resolvedClientId;
        else changes.clientName = c.clientName;
      }
      if (c.assigneeName) {
        if (resolvedAssigneeIds.length) changes.assigneeIds = resolvedAssigneeIds;
        else changes.assigneeName = c.assigneeName;
      }

      payload.changes = changes;

      const res = await fetch('/api/ai/actions/update-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { taskId?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? SUPAI_REFUSAL_TASK_UPDATE);
        return;
      }
      if (data.taskId) {
        setUpdatedId(data.taskId);
        onTaskUpdated?.(data.taskId);
        toast.success('Tâche mise à jour');
      }
    } catch {
      toast.error(SUPAI_ERROR_NETWORK);
    } finally {
      setConfirming(false);
    }
  }

  if (updatedId) {
    return (
      <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
        <p className="font-medium text-foreground">Tâche mise à jour</p>
        <p className="mt-1 text-muted-foreground">
          {resolved?.taskSnapshot?.title ?? localDraft.currentTitle ?? localDraft.taskSearchText}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3 rounded-full">
          <Link href={hrefTasksOpenDetail(updatedId)}>Voir la tâche</Link>
        </Button>
      </div>
    );
  }

  if (!canUpdate) {
    return (
      <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">
        {SUPAI_REFUSAL_TASK_UPDATE}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-primary/25 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground">Modification de tâche</p>
          <p className="text-xs text-muted-foreground">
            Vérifiez la tâche ciblée et les changements avant confirmation.
          </p>
        </div>
        {!editing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-2"
            onClick={() => setEditing(true)}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
            Modifier
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
          Recherche de la tâche…
        </div>
      ) : null}

      {!loading && lookupStatus === 'not_found' ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-900 dark:text-amber-100">
          {TASK_UPDATE_DRAFT_NOT_FOUND}
        </p>
      ) : null}

      {!loading && lookupStatus === 'ambiguous' ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Plusieurs tâches correspondent — choisissez la bonne fiche :
          </p>
          <div className="flex flex-col gap-2">
            {ambiguousMatches.map((match) => (
              <Button
                key={match.id}
                type="button"
                variant={selectedTaskId === match.id ? 'primary' : 'outline'}
                size="sm"
                className="h-auto justify-start rounded-lg px-3 py-2 text-left"
                onClick={() => setSelectedTaskId(match.id)}
              >
                <span className="font-medium">{match.title}</span>
                <span className="ml-2 text-xs opacity-80">
                  {[match.clientName, match.assigneeName].filter(Boolean).join(' · ') || '—'}
                </span>
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && (clientWarning || assigneeWarning || clientResolvedHint || assigneeResolvedHint) ? (
        <div className="mb-4 space-y-2">
          {clientWarning ? (
            <p className="whitespace-pre-line rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              {clientWarning}
            </p>
          ) : null}
          {!clientWarning && clientResolvedHint ? (
            <DraftReferenceResolvedHint hint={clientResolvedHint} />
          ) : null}
          {clientPreview?.status === 'ambiguous' && !resolvedClientId ? (
            <DraftReferenceAmbiguousPicker
              kind="client"
              preview={clientPreview}
              onSelect={(id, label) => {
                setResolvedClientId(id);
                setLocalDraft((prev) => ({
                  ...prev,
                  changes: { ...prev.changes, clientName: label },
                }));
              }}
            />
          ) : null}
          {assigneeWarning ? (
            <p className="whitespace-pre-line rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              {assigneeWarning}
            </p>
          ) : null}
          {!assigneeWarning && assigneeResolvedHint ? (
            <DraftReferenceResolvedHint hint={assigneeResolvedHint} />
          ) : null}
          {assigneePreview?.status === 'ambiguous' && resolvedAssigneeIds.length === 0 ? (
            <DraftReferenceAmbiguousPicker
              kind="assignee"
              preview={assigneePreview}
              onSelect={(id, label) => {
                setResolvedAssigneeIds([id]);
                setLocalDraft((prev) => ({
                  ...prev,
                  changes: { ...prev.changes, assigneeName: label },
                }));
              }}
            />
          ) : null}
        </div>
      ) : null}

      {!loading && resolved?.taskSnapshot ? (
        <div className="mb-4 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tâche actuelle
          </p>
          <dl className="grid gap-1.5 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] text-muted-foreground">Titre</dt>
              <dd>{resolved.taskSnapshot.title}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Client</dt>
              <dd>{resolved.taskSnapshot.clientName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Assigné(s)</dt>
              <dd>{resolved.taskSnapshot.assigneeName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Échéance</dt>
              <dd>{resolved.taskSnapshot.deadlineLabel ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Statut</dt>
              <dd>{resolved.taskSnapshot.statusLabel}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Priorité</dt>
              <dd>{resolved.taskSnapshot.priorityLabel}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {!loading && !hasChanges ? (
        <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-900 dark:text-amber-100">
          {TASK_UPDATE_DRAFT_EMPTY_CHANGES}
        </p>
      ) : null}

      {!loading && changeRows.length > 0 ? (
        <div className="mb-4 overflow-x-auto">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Changements proposés
          </p>
          <table className="w-full min-w-[280px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11px] text-muted-foreground">
                <th className="py-1.5 pr-2 font-medium">Champ</th>
                <th className="py-1.5 pr-2 font-medium">Avant</th>
                <th className="py-1.5 font-medium">Après</th>
              </tr>
            </thead>
            <tbody>
              {changeRows.map((row) => (
                <tr key={row.field} className="border-b border-border/40">
                  <td className="py-2 pr-2 font-medium">{row.field}</td>
                  <td className="py-2 pr-2 text-muted-foreground">{row.oldValue}</td>
                  <td className="py-2 text-foreground">{row.newValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {editing ? (
        <div className="mb-4 space-y-3 rounded-lg border border-dashed border-border/70 p-3">
          <div>
            <Label htmlFor="update-title">Nouveau titre</Label>
            <Input
              id="update-title"
              value={localDraft.changes.title ?? ''}
              onChange={(e) =>
                setLocalDraft((prev) => ({
                  ...prev,
                  changes: { ...prev.changes, title: e.target.value || undefined },
                }))
              }
            />
          </div>
          <OperationalDatetimeField
            id="update-deadline"
            label="Échéance (datetime-local)"
            value={toDatetimeLocal(localDraft.changes.deadlineIso)}
            onValueChange={(next) => {
              const iso = fromDatetimeLocal(next);
              setLocalDraft((prev) => ({
                ...prev,
                changes: {
                  ...prev.changes,
                  clearDeadline: false,
                  deadlineIso: iso,
                  deadlineText: next || undefined,
                },
              }));
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="update-status">Statut</Label>
              <select
                id="update-status"
                className={cn(
                  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                )}
                value={localDraft.changes.status ?? ''}
                onChange={(e) =>
                  setLocalDraft((prev) => ({
                    ...prev,
                    changes: {
                      ...prev.changes,
                      status: (e.target.value || undefined) as typeof prev.changes.status,
                    },
                  }))
                }
              >
                <option value="">— inchangé —</option>
                {AI_TASK_UPDATE_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {AI_TASK_UPDATE_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="update-priority">Priorité</Label>
              <select
                id="update-priority"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={localDraft.changes.priority ?? ''}
                onChange={(e) =>
                  setLocalDraft((prev) => ({
                    ...prev,
                    changes: {
                      ...prev.changes,
                      priority: (e.target.value || undefined) as typeof prev.changes.priority,
                    },
                  }))
                }
              >
                <option value="">— inchangé —</option>
                {AI_TASK_DRAFT_PRIORITY.map((p) => (
                  <option key={p} value={p}>
                    {AI_TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="update-client">Client</Label>
            <Input
              id="update-client"
              value={localDraft.changes.clientName ?? ''}
              onChange={(e) =>
                setLocalDraft((prev) => ({
                  ...prev,
                  changes: { ...prev.changes, clientName: e.target.value || undefined },
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="update-assignee">Assigné</Label>
            <Input
              id="update-assignee"
              value={localDraft.changes.assigneeName ?? ''}
              onChange={(e) =>
                setLocalDraft((prev) => ({
                  ...prev,
                  changes: { ...prev.changes, assigneeName: e.target.value || undefined },
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="update-description">Description</Label>
            <Textarea
              id="update-description"
              rows={3}
              value={localDraft.changes.description ?? ''}
              onChange={(e) =>
                setLocalDraft((prev) => ({
                  ...prev,
                  changes: { ...prev.changes, description: e.target.value || undefined },
                }))
              }
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              setEditing(false);
              void loadResolution(selectedTaskId);
            }}
          >
            Appliquer au brouillon
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="rounded-full"
          disabled={!canConfirm}
          onClick={() => void handleConfirm()}
        >
          {confirming ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          Confirmer la modification
        </Button>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onCancel}>
          <X className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Annuler
        </Button>
      </div>
    </div>
  );
}
