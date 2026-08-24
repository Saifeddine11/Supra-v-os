import { format } from 'date-fns';
import type { InvoiceStatus, ProjectStatus } from '@/types/database';
import type { CockpitProjectHealth, CockpitWorkloadState } from '@/types/dashboard-cockpit';

/**
 * Heures utilisées quand `tasks.estimated_hours` est vide.
 * Hypothèse opérationnelle documentée — pas une capacité réelle.
 */
export const DEFAULT_ESTIMATED_TASK_HOURS = 4;

/**
 * Charge individuelle, dans l’ordre :
 * 1. ≥ 3 tâches en retard, ou ≥ 100 % des heures estimées / capacité hebdo, ou > 12 tâches ouvertes → overloaded
 * 2. ≥ 1 retard, ou ≥ 75 % heures, ou > 6 ouvertes → busy
 * 3. > 2 ouvertes, ou ≥ 40 % heures → normal
 * 4. sinon available
 */
export function deriveWorkload(open: number, overdue: number, hoursPct: number): CockpitWorkloadState {
  if (overdue >= 3 || hoursPct >= 100 || open > 12) return 'overloaded';
  if (overdue >= 1 || hoursPct >= 75 || open > 6) return 'busy';
  if (open > 2 || hoursPct >= 40) return 'normal';
  return 'available';
}

export function projectHealth(opts: {
  status: ProjectStatus;
  deadline: string | null;
  overdueTasks: number;
  blockedTasks: number;
  now: Date;
}): CockpitProjectHealth {
  if (opts.status === 'validated' || opts.status === 'delivered' || opts.status === 'archived') {
    return 'completed';
  }
  if (opts.blockedTasks > 0) return 'blocked';
  if (opts.status === 'waiting_content') return 'blocked';
  const lateDeadline = Boolean(opts.deadline && opts.deadline < format(opts.now, 'yyyy-MM-dd'));
  if (lateDeadline) return 'late';
  if (opts.status === 'waiting_client' || opts.status === 'review' || opts.overdueTasks > 0) return 'attention';
  if (opts.deadline) {
    const days = (new Date(`${opts.deadline}T12:00:00`).getTime() - opts.now.getTime()) / 86_400_000;
    if (days <= 7 && days >= 0) return 'attention';
  }
  return 'on_track';
}

/** Reste dû sur une facture. Brouillons, payées et annulées = 0. Jamais négatif. */
export function invoiceResidual(status: InvoiceStatus | string, total: number, paid: number): number {
  if (status === 'paid' || status === 'cancelled' || status === 'draft') return 0;
  const t = Number(total);
  const p = Number(paid);
  if (!Number.isFinite(t)) return 0;
  const paidSafe = Number.isFinite(p) ? p : 0;
  return Math.max(0, Math.round((t - paidSafe) * 100) / 100);
}
