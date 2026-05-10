import { createClient } from '@/lib/supabase/server';
import type { AgencyMonthlyGoalRow } from '@/types/database';

function normalizeGoalRow(row: Record<string, unknown> | null): AgencyMonthlyGoalRow | null {
  if (!row) return null;
  return {
    id: String(row.id),
    year: Number(row.year),
    month: Number(row.month),
    revenue_goal: Number(row.revenue_goal ?? 0),
    client_goal: row.client_goal == null ? null : Number(row.client_goal),
    video_goal: row.video_goal == null ? null : Number(row.video_goal),
    task_goal: row.task_goal == null ? null : Number(row.task_goal),
    notes: row.notes == null ? null : String(row.notes),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/** Mois courant (timezone locale du serveur — aligné sur startOfMonth du dashboard). */
export function currentDashboardYearMonth(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export async function getAgencyMonthlyGoalForMonth(
  year: number,
  month: number
): Promise<AgencyMonthlyGoalRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('agency_monthly_goals')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeGoalRow(data as Record<string, unknown>);
}
