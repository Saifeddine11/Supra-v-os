'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageAgencySettingsInUi } from '@/lib/auth/capabilities';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';

export async function upsertAgencyMonthlyGoalAction(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageAgencySettingsInUi(ctx.role)) {
    return actionError('Réservé aux administrateurs.');
  }

  const year = Number(String(formData.get('year') ?? '').trim());
  const month = Number(String(formData.get('month') ?? '').trim());
  if (!Number.isFinite(year) || year < 2020 || year > 2100) {
    return actionError('Année invalide.');
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return actionError('Mois invalide.');
  }

  const revenueRaw = String(formData.get('revenue_goal') ?? '').trim();
  const revenue_goal = revenueRaw === '' ? 0 : Number(revenueRaw.replace(',', '.'));
  if (!Number.isFinite(revenue_goal) || revenue_goal < 0) {
    return actionError('Objectif CA invalide.');
  }

  const parseOptInt = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    if (v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };

  const client_goal = parseOptInt('client_goal');
  const video_goal = parseOptInt('video_goal');
  const task_goal = parseOptInt('task_goal');
  const notesRaw = String(formData.get('notes') ?? '').trim();
  const notes = notesRaw === '' ? null : notesRaw.slice(0, 4000);

  const supabase = await createClient();
  const { error } = await supabase.from('agency_monthly_goals').upsert(
    {
      year,
      month,
      revenue_goal,
      client_goal,
      video_goal,
      task_goal,
      notes,
    },
    { onConflict: 'year,month' }
  );

  if (error) return actionError(getPostgrestError(error));

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return actionOk();
}
