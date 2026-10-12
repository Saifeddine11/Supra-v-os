'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TaskEnriched } from '@/types/database';
import { TASK_STATUS_MAP } from '@/types/domain';
import {
  decideCompletionAction,
  decideDeletionAction,
  decideProposedTaskAction,
  markTaskPendingValidationAction,
  requestTaskDeletionAction,
  saveTaskProofAction,
} from './accountability-actions';

function hasProof(task: TaskEnriched): boolean {
  return Boolean(task.proof_url?.trim() || task.proof_note?.trim());
}

export function TaskAccountabilityQueue({
  tasks,
  canReview,
}: {
  tasks: TaskEnriched[];
  canReview: boolean;
}) {
  const proposed = tasks.filter((t) => t.status === 'proposed');
  const pendingDone = tasks.filter((t) => t.status === 'completed_pending_validation');
  const deletionRequests = tasks.filter((t) => t.deletion_request_status === 'pending' && !t.deleted_at);
  if (canReview) {
    if (proposed.length + pendingDone.length + deletionRequests.length === 0) return null;
    return (
      <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">File de validation</h2>
        <QueueBlock title="Tâches proposées" tasks={proposed} kind="proposed" />
        <QueueBlock title="Terminées à valider" tasks={pendingDone} kind="completion" />
        <QueueBlock title="Demandes de suppression" tasks={deletionRequests} kind="deletion" />
      </section>
    );
  }

  const own = tasks.filter(
    (t) => t.status !== 'done' && t.status !== 'archived' && !t.deleted_at,
  );
  if (own.length === 0) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Mes tâches</h2>
      <ul className="space-y-3">
        {own.map((task) => (
          <li key={task.id} className="space-y-2 border-b border-border/50 pb-3 last:border-0">
            <p className="text-sm text-foreground">
              {task.title}{' '}
              <span className="text-muted-foreground">· {TASK_STATUS_MAP[task.status].label}</span>
            </p>
            <EmployeeTaskControls task={task} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function QueueBlock({
  title,
  tasks,
  kind,
}: {
  title: string;
  tasks: TaskEnriched[];
  kind: 'proposed' | 'completion' | 'deletion';
}) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={`${kind}-${task.id}`} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-foreground">{task.title}</span>
            <ReviewControls task={task} kind={kind} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewControls({
  task,
  kind,
}: {
  task: TaskEnriched;
  kind: 'proposed' | 'completion' | 'deletion';
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();

  const run = (decision: 'approve' | 'reject' | 'validate') => {
    startTransition(async () => {
      const res =
        kind === 'proposed'
          ? await decideProposedTaskAction(task.id, decision === 'reject' ? 'reject' : 'approve', reason)
          : kind === 'completion'
            ? await decideCompletionAction(task.id, decision === 'reject' ? 'reject' : 'validate', reason)
            : await decideDeletionAction(task.id, decision === 'reject' ? 'reject' : 'approve', reason);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Décision enregistrée');
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Raison du refus"
        className="h-8 w-40"
      />
      <Button type="button" size="sm" disabled={pending} onClick={() => run(kind === 'completion' ? 'validate' : 'approve')}>
        {kind === 'completion' ? 'Valider' : 'Approuver'}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run('reject')}>
        Refuser
      </Button>
    </div>
  );
}

export function EmployeeTaskControls({ task }: { task: TaskEnriched }) {
  const router = useRouter();
  const [proofUrl, setProofUrl] = useState(task.proof_url ?? '');
  const [proofNote, setProofNote] = useState(task.proof_note ?? '');
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();
  const proofReady = hasProof(task) || Boolean(proofUrl.trim() || proofNote.trim());

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Input
        value={proofUrl}
        onChange={(e) => setProofUrl(e.target.value)}
        placeholder="Lien de preuve"
        className="h-8 sm:w-48"
      />
      <Input
        value={proofNote}
        onChange={(e) => setProofNote(e.target.value)}
        placeholder="Note de preuve"
        className="h-8 sm:w-48"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const res = await saveTaskProofAction(task.id, proofUrl, proofNote);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success('Preuve enregistrée');
              router.refresh();
            }
          });
        }}
      >
        Ajouter la preuve
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={pending || !proofReady || task.status === 'completed_pending_validation' || task.status === 'proposed'}
        onClick={() => {
          startTransition(async () => {
            const saved = await saveTaskProofAction(task.id, proofUrl, proofNote);
            if (!saved.ok && !hasProof(task)) {
              toast.error(saved.error);
              return;
            }
            const res = await markTaskPendingValidationAction(task.id);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success('En attente de validation');
              router.refresh();
            }
          });
        }}
      >
        Marquer terminé
      </Button>
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Raison de suppression"
        className="h-8 sm:w-48"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || task.deletion_request_status === 'pending'}
        onClick={() => {
          startTransition(async () => {
            const res = await requestTaskDeletionAction(task.id, reason);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success('Demande envoyée');
              router.refresh();
            }
          });
        }}
      >
        Demander suppression
      </Button>
    </div>
  );
}
