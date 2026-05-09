'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canModifyClients } from '@/lib/auth/capabilities';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import type { ReportHighlight, ReportType } from '@/types/database';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { notifyAdminsAndPMs } from '@/lib/notifications/notify';
import { logStaffActivity } from '@/lib/activity/log-activity';
import { assertReportRecordVisible } from '@/lib/auth/data-scope';

function highlightsFromWorkText(text: string): ReportHighlight[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ title: '', description: line }));
}

export async function createReportAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyClients(ctx.role)) {
    return actionError('Droits insuffisants pour créer un rapport.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionError('Session expirée.');

  const clientId = String(formData.get('client_id') ?? '').trim();
  if (!clientId) return actionError('Le client est requis.');

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return actionError('Le titre est requis.');

  const type = String(formData.get('type') ?? 'monthly').trim() as ReportType;
  const periodStart = String(formData.get('period_start') ?? '').trim() || null;
  const periodEnd = String(formData.get('period_end') ?? '').trim() || null;
  const summary = String(formData.get('summary') ?? '').trim() || null;
  const workCompleted = String(formData.get('work_completed') ?? '').trim();
  const highlights = highlightsFromWorkText(workCompleted);
  const nextActions = String(formData.get('next_actions') ?? '').trim() || null;
  const recommendations = String(formData.get('recommendations') ?? '').trim() || null;
  const whatsappText = String(formData.get('whatsapp_text') ?? '').trim() || null;
  const pdfUrl = String(formData.get('pdf_url') ?? '').trim() || null;
  const visible = formData.getAll('visible_to_client').includes('true');

  if (
    !(await assertReportRecordVisible(supabase, ctx, {
      client_id: clientId,
      type,
    }))
  ) {
    return actionError('Création de rapport non autorisée pour ce client ou ce type.');
  }

  const { data: row, error } = await supabase
    .from('reports')
    .insert({
      client_id: clientId,
      type,
      title,
      period_start: periodStart,
      period_end: periodEnd,
      summary,
      highlights,
      next_actions: nextActions,
      recommendations,
      whatsapp_text: whatsappText,
      pdf_url: pdfUrl,
      visible_to_client: visible,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !row) return actionError(error ? getPostgrestError(error) : 'Échec création rapport.');

  await logStaffActivity(ctx, {
    action: 'created',
    entityType: 'report',
    entityId: row.id,
    metadata: { title, client_id: clientId, visible_to_client: visible },
  });

  const base = appBaseUrl();
  await notifyAdminsAndPMs({
    type: 'report_due',
    priority: visible ? 'high' : 'normal',
    title: visible ? 'Nouveau rapport (visible client)' : 'Nouveau rapport',
    message: title,
    relatedEntityType: 'report',
    relatedEntityId: row.id,
    linkUrl: `${base}/reports/${row.id}`,
  });

  revalidatePath('/reports');
  revalidatePath('/dashboard');
  revalidatePath(`/clients/${clientId}`);
  return actionOk({ id: row.id });
}

export async function updateReportAction(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyClients(ctx.role)) return actionError('Droits insuffisants.');

  const supabase = await createClient();
  const { data: existingRep } = await supabase
    .from('reports')
    .select('client_id, type')
    .eq('id', id)
    .maybeSingle();
  if (
    !existingRep ||
    !(await assertReportRecordVisible(supabase, ctx, {
      client_id: existingRep.client_id,
      type: existingRep.type,
    }))
  ) {
    return actionError('Rapport inaccessible.');
  }

  const clientId = String(formData.get('client_id') ?? '').trim();
  if (!clientId) return actionError('Le client est requis.');

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return actionError('Le titre est requis.');

  const type = String(formData.get('type') ?? 'monthly').trim() as ReportType;
  if (
    !(await assertReportRecordVisible(supabase, ctx, {
      client_id: clientId,
      type,
    }))
  ) {
    return actionError('Modification non autorisée pour ce client ou ce type.');
  }

  const periodStart = String(formData.get('period_start') ?? '').trim() || null;
  const periodEnd = String(formData.get('period_end') ?? '').trim() || null;
  const summary = String(formData.get('summary') ?? '').trim() || null;
  const workCompleted = String(formData.get('work_completed') ?? '').trim();
  const highlights = highlightsFromWorkText(workCompleted);
  const nextActions = String(formData.get('next_actions') ?? '').trim() || null;
  const recommendations = String(formData.get('recommendations') ?? '').trim() || null;
  const whatsappText = String(formData.get('whatsapp_text') ?? '').trim() || null;
  const pdfUrl = String(formData.get('pdf_url') ?? '').trim() || null;
  const visible = formData.getAll('visible_to_client').includes('true');

  const { data: before } = await supabase
    .from('reports')
    .select('visible_to_client')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('reports')
    .update({
      client_id: clientId,
      type,
      title,
      period_start: periodStart,
      period_end: periodEnd,
      summary,
      highlights,
      next_actions: nextActions,
      recommendations,
      whatsapp_text: whatsappText,
      pdf_url: pdfUrl,
      visible_to_client: visible,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'report',
    entityId: id,
    metadata: { title, visible_to_client: visible },
  });

  if (visible && !before?.visible_to_client) {
    const base = appBaseUrl();
    await notifyAdminsAndPMs({
      type: 'report_due',
      priority: 'normal',
      title: 'Rapport visible côté client',
      message: title,
      relatedEntityType: 'report',
      relatedEntityId: id,
      linkUrl: `${base}/reports/${id}`,
    });
  }

  revalidatePath('/reports');
  revalidatePath(`/reports/${id}`);
  revalidatePath('/dashboard');
  revalidatePath(`/clients/${clientId}`);
  return actionOk();
}

export async function deleteReportAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyClients(ctx.role)) return actionError('Droits insuffisants.');

  const supabase = await createClient();
  const { data: rep } = await supabase.from('reports').select('client_id, type').eq('id', id).maybeSingle();
  if (
    !rep ||
    !(await assertReportRecordVisible(supabase, ctx, {
      client_id: rep.client_id,
      type: rep.type,
    }))
  ) {
    return actionError('Rapport inaccessible.');
  }

  const { error } = await supabase.from('reports').delete().eq('id', id);
  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'deleted',
    entityType: 'report',
    entityId: id,
    metadata: { client_id: rep?.client_id },
  });

  revalidatePath('/reports');
  revalidatePath('/dashboard');
  if (rep?.client_id) revalidatePath(`/clients/${rep.client_id}`);
  return actionOk();
}
