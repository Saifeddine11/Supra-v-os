'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageProjects } from '@/lib/auth/capabilities';
import { assertClientRecordVisible, assertVideoRecordVisible } from '@/lib/auth/data-scope';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';

function monthIso(year: number, month1: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month1)}-01`;
}

export async function upsertEditorialCalendarAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageProjects(ctx.role)) return actionError('Droits insuffisants.');

  const supabase = await createClient();
  const client_id = String(formData.get('client_id') ?? '').trim();
  if (!client_id) return actionError('Client requis.');
  if (!(await assertClientRecordVisible(supabase, ctx, client_id))) {
    return actionError('Client non autorisé pour le calendrier éditorial.');
  }

  const year = Number(formData.get('year'));
  const month = Number(formData.get('month'));
  if (!year || !month) return actionError('Mois invalide.');
  const quota = Number(formData.get('quota') ?? 0);
  const m = monthIso(year, month);
  const notes = String(formData.get('notes') ?? '').trim() || null;

  const { data: existing } = await supabase
    .from('editorial_calendars')
    .select('id')
    .eq('client_id', client_id)
    .eq('month', m)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from('editorial_calendars')
      .update({ quota, notes, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) return actionError(getPostgrestError(error));
    revalidatePath('/editorial');
    return actionOk({ id: existing.id });
  }

  const { data, error } = await supabase
    .from('editorial_calendars')
    .insert({ client_id, month: m, quota, notes })
    .select('id')
    .single();
  if (error) return actionError(getPostgrestError(error));
  if (!data?.id) return actionError('Erreur création calendrier.');
  revalidatePath('/editorial');
  return actionOk({ id: data.id });
}

export async function attachVideoToCalendarAction(videoId: string, calendarId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageProjects(ctx.role)) return actionError('Droits insuffisants.');
  const supabase = await createClient();

  const { data: cal } = await supabase
    .from('editorial_calendars')
    .select('client_id')
    .eq('id', calendarId)
    .maybeSingle();
  const { data: vid } = await supabase.from('videos').select('client_id').eq('id', videoId).maybeSingle();
  if (!cal?.client_id || !vid?.client_id) return actionError('Calendrier ou vidéo introuvable.');
  if (cal.client_id !== vid.client_id) {
    return actionError('La vidéo et le calendrier doivent appartenir au même client.');
  }
  if (!(await assertClientRecordVisible(supabase, ctx, cal.client_id))) {
    return actionError('Action non autorisée pour ce client.');
  }
  if (!(await assertVideoRecordVisible(supabase, ctx, videoId))) {
    return actionError('Vidéo inaccessible.');
  }

  const { error } = await supabase
    .from('videos')
    .update({ editorial_calendar_id: calendarId, updated_at: new Date().toISOString() })
    .eq('id', videoId);
  if (error) return actionError(getPostgrestError(error));
  revalidatePath('/editorial');
  revalidatePath('/videos');
  return actionOk();
}
