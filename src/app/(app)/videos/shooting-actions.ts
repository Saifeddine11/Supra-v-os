'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import type { AuthContext } from '@/lib/auth/permissions';
import { assertVideoRecordVisible } from '@/lib/auth/data-scope';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import type { VideoStatus } from '@/types/database';
import type { VideoWithClient } from '@/lib/data/videos';
import {
  appendNoteToVideoProductionTask,
  syncVideoLinkedProductionTaskFromDb,
} from '@/lib/tasks/video-production-task';
import { getEmployeeUserId, insertNotifications, getUserIdsByRoles, type NotificationInsert } from '@/lib/notifications/notify';
import { logStaffActivity } from '@/lib/activity/log-activity';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import {
  labelForPostponePreset,
  videoCanConfirmShootingDone,
  videoCanMarkShootingInProgress,
  videoCanPostponeShooting,
  viewerCanRespondToShootingConfirmation,
} from '@/lib/videos/shooting-confirmation';
import { scheduleVideoKanbanAdvancement } from '@/lib/discord/kanban-advancement';
import { validateOperationalFutureDate } from '@/lib/dates/validate-future-date';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertEmployeeActive(ctx: AuthContext): string | null {
  if (!ctx.employee) return 'Profil employé introuvable.';
  if (!ctx.employee.is_active || ctx.employee.archived_at) return 'Compte employé inactif.';
  return null;
}

type VideoShootRow = {
  id: string;
  title: string;
  status: VideoStatus;
  shooting_date: string | null;
  shooting_completed_at: string | null;
  shooting_started_at?: string | null;
  client_id: string;
  editor_id: string | null;
  cameraman_id: string | null;
  clients: { name: string } | null;
};

async function loadVideoForShooting(admin: ReturnType<typeof createAdminClient>, videoId: string) {
  const { data: v, error } = await admin
    .from('videos')
    .select(
      'id,title,status,shooting_date,shooting_completed_at,shooting_started_at,client_id,editor_id,cameraman_id,clients(name)',
    )
    .eq('id', videoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return v as VideoShootRow | null;
}

async function attachCameramen(
  admin: ReturnType<typeof createAdminClient>,
  v: VideoShootRow,
): Promise<Pick<VideoWithClient, 'cameramen' | 'cameraman_id'>> {
  const { data: va } = await admin
    .from('video_assignments')
    .select('employee_id, assignment_role')
    .eq('video_id', v.id);
  const cameramen: { id: string; full_name: string }[] = [];
  const camIds = new Set<string>();
  if (v.cameraman_id) camIds.add(v.cameraman_id);
  for (const r of va ?? []) {
    if ((r as { assignment_role: string }).assignment_role === 'cameraman' && (r as { employee_id: string }).employee_id) {
      camIds.add((r as { employee_id: string }).employee_id);
    }
  }
  if (camIds.size === 0) return { cameraman_id: v.cameraman_id, cameramen: [] };
  const { data: emps } = await admin.from('employees').select('id, full_name').in('id', [...camIds]);
  const nameMap = new Map<string, string>();
  for (const e of emps ?? []) nameMap.set(e.id as string, String((e as { full_name: string }).full_name));
  for (const id of camIds) {
    cameramen.push({ id, full_name: nameMap.get(id) ?? '—' });
  }
  return { cameraman_id: v.cameraman_id, cameramen };
}

async function collectEditorEmployeeIds(admin: ReturnType<typeof createAdminClient>, videoId: string, editorId: string | null) {
  const ids = new Set<string>();
  if (editorId) ids.add(editorId);
  const { data: va } = await admin
    .from('video_assignments')
    .select('employee_id')
    .eq('video_id', videoId)
    .eq('assignment_role', 'editor');
  for (const r of va ?? []) {
    const eid = (r as { employee_id: string }).employee_id;
    if (eid) ids.add(eid);
  }
  return [...ids];
}

async function collectCameramanEmployeeIds(admin: ReturnType<typeof createAdminClient>, videoId: string, cameramanId: string | null) {
  const ids = new Set<string>();
  if (cameramanId) ids.add(cameramanId);
  const { data: va } = await admin
    .from('video_assignments')
    .select('employee_id')
    .eq('video_id', videoId)
    .eq('assignment_role', 'cameraman');
  for (const r of va ?? []) {
    const eid = (r as { employee_id: string }).employee_id;
    if (eid) ids.add(eid);
  }
  return [...ids];
}

function formatVideoShootingActionError(err: unknown): string {
  const raw =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : getPostgrestError(err);
  const lower = raw.toLowerCase();
  if (lower.includes('row-level security') || lower.includes('rls')) {
    return 'Action impossible : permissions insuffisantes.';
  }
  return raw;
}

export async function confirmVideoShootingDoneAction(videoId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');
  const empErr = assertEmployeeActive(ctx);
  if (empErr) return actionError(empErr);

  const id = String(videoId ?? '').trim();
  if (!id || !UUID_RE.test(id)) return actionError('Identifiant vidéo invalide.');

  const userSb = await createClient();
  if (!(await assertVideoRecordVisible(userSb, ctx, id))) {
    return actionError('Vidéo introuvable ou accès refusé.');
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return actionError('Configuration serveur incomplète.');
  }

  const v = await loadVideoForShooting(admin, id);
  if (!v) return actionError('Vidéo introuvable.');

  const now = new Date();
  if (!videoCanConfirmShootingDone(v, now)) {
    return actionError('Cette vidéo ne nécessite plus de confirmation de tournage.');
  }

  const { cameramen, cameraman_id } = await attachCameramen(admin, v);
  if (!viewerCanRespondToShootingConfirmation(ctx.role, ctx.employee?.id, { cameramen, cameraman_id })) {
    return actionError('Vous n’êtes pas autorisé à confirmer ce tournage.');
  }

  const completedAt = now.toISOString();
  const { error: upErr } = await admin
    .from('videos')
    .update({
      status: 'editing' as VideoStatus,
      public_status: 'in_editing',
      shooting_completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq('id', id);

  if (upErr) {
    console.error('[confirmVideoShootingDoneAction]', upErr);
    return actionError(formatVideoShootingActionError(upErr));
  }

  scheduleVideoKanbanAdvancement(id, v.status, 'editing');

  try {
    await admin.from('video_shooting_events').insert({
      video_id: id,
      event_type: 'confirmed',
      old_shooting_at: v.shooting_date,
      new_shooting_at: null,
      reason: null,
      note: null,
      created_by: ctx.userId,
    });
  } catch (e) {
    console.error('[confirmVideoShootingDoneAction] event', e);
  }

  const noteFr = `Tournage confirmé le ${new Date(completedAt).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}, passage automatique en montage.`;
  try {
    await appendNoteToVideoProductionTask(admin, id, noteFr);
  } catch {
    /* best-effort */
  }

  try {
    await syncVideoLinkedProductionTaskFromDb(admin, id);
  } catch {
    /* best-effort */
  }

  const base = appBaseUrl();
  const editorIds = await collectEditorEmployeeIds(admin, id, v.editor_id);
  const rows: Parameters<typeof insertNotifications>[0] = [];
  for (const empId of editorIds) {
    const uid = await getEmployeeUserId(empId);
    if (uid && uid !== ctx.userId) {
      rows.push({
        recipient_user_id: uid,
        type: 'system',
        priority: 'normal',
        title: 'Tournage confirmé',
        message: `Le tournage est confirmé pour « ${v.title} ». Le montage peut commencer.`,
        related_entity_type: 'video',
        related_entity_id: id,
        link_url: `${base}/videos`,
      });
    }
  }
  if (rows.length) await insertNotifications(rows);

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'video',
    entityId: id,
    metadata: { shooting_confirmed: true },
  });

  revalidatePath('/videos');
  revalidatePath('/tasks');
  revalidatePath('/tasks/calendar');
  revalidatePath('/dashboard');
  return actionOk();
}

const MAX_SHOOTING_NOTE_LEN = 2000;

export async function markVideoShootingInProgressAction(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');
  const empErr = assertEmployeeActive(ctx);
  if (empErr) return actionError(empErr);

  const id = String(formData.get('video_id') ?? '').trim();
  if (!id || !UUID_RE.test(id)) return actionError('Identifiant vidéo invalide.');

  const expectedEndRaw = String(formData.get('expected_end_at') ?? '').trim();
  const internalNote = String(formData.get('internal_note') ?? '').trim();
  if (internalNote.length > MAX_SHOOTING_NOTE_LEN) {
    return actionError('La note est trop longue.');
  }

  let expectedEndAt: string | null = null;
  if (expectedEndRaw) {
    const ms = Date.parse(expectedEndRaw);
    if (Number.isNaN(ms)) return actionError('Date de fin prévue invalide.');
    expectedEndAt = new Date(ms).toISOString();
  }

  const userSb = await createClient();
  if (!(await assertVideoRecordVisible(userSb, ctx, id))) {
    return actionError('Vidéo introuvable ou accès refusé.');
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return actionError('Configuration serveur incomplète.');
  }

  const v = await loadVideoForShooting(admin, id);
  if (!v) return actionError('Vidéo introuvable.');

  const now = new Date();
  if (!videoCanMarkShootingInProgress(v, now)) {
    return actionError('Cette vidéo ne peut pas être marquée en tournage en cours.');
  }

  const { cameramen, cameraman_id } = await attachCameramen(admin, v);
  if (!viewerCanRespondToShootingConfirmation(ctx.role, ctx.employee?.id, { cameramen, cameraman_id })) {
    return actionError('Vous n’êtes pas autorisé à modifier ce tournage.');
  }

  const startedAt = now.toISOString();
  const patch: Record<string, unknown> = {
    status: 'shooting_in_progress' as VideoStatus,
    public_status: 'in_production',
    shooting_expected_end_at: expectedEndAt,
    updated_at: startedAt,
  };
  if (!v.shooting_started_at) {
    patch.shooting_started_at = startedAt;
  }

  const { error: upErr } = await admin.from('videos').update(patch).eq('id', id);
  if (upErr) {
    console.error('[markVideoShootingInProgressAction]', upErr);
    return actionError(formatVideoShootingActionError(upErr));
  }

  scheduleVideoKanbanAdvancement(id, v.status, 'shooting_in_progress');

  try {
    await admin.from('video_shooting_events').insert({
      video_id: id,
      event_type: 'in_progress',
      old_shooting_at: v.shooting_date,
      new_shooting_at: null,
      expected_end_at: expectedEndAt,
      reason: null,
      note: internalNote || null,
      created_by: ctx.userId,
    });
  } catch (e) {
    console.error('[markVideoShootingInProgressAction] event', e);
  }

  const noteFr = `Tournage marqué en cours le ${new Date(startedAt).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}.${expectedEndAt ? ` Fin prévue : ${new Date(expectedEndAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.` : ''}${internalNote ? ` ${internalNote}` : ''}`;
  try {
    await appendNoteToVideoProductionTask(admin, id, noteFr);
  } catch {
    /* best-effort */
  }

  try {
    await syncVideoLinkedProductionTaskFromDb(admin, id);
  } catch {
    /* best-effort */
  }

  const base = appBaseUrl();
  const editorIds = await collectEditorEmployeeIds(admin, id, v.editor_id);
  const pmAdminIds = await getUserIdsByRoles(['admin', 'project_manager']);
  const rows: Parameters<typeof insertNotifications>[0] = [];

  for (const empId of editorIds) {
    const uid = await getEmployeeUserId(empId);
    if (uid && uid !== ctx.userId) {
      rows.push({
        recipient_user_id: uid,
        type: 'system',
        priority: 'normal',
        title: 'Tournage en cours',
        message: `Le tournage est en cours pour « ${v.title} ».`,
        related_entity_type: 'video',
        related_entity_id: id,
        link_url: `${base}/videos`,
      });
    }
  }
  for (const uid of pmAdminIds) {
    if (uid === ctx.userId) continue;
    rows.push({
      recipient_user_id: uid,
      type: 'system',
      priority: 'normal',
      title: 'Tournage en cours',
      message: `Tournage en cours — « ${v.title} » (${v.clients?.name ?? 'Client'}).`,
      related_entity_type: 'video',
      related_entity_id: id,
      link_url: `${base}/videos`,
    });
  }
  if (rows.length) await insertNotifications(rows);

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'video',
    entityId: id,
    metadata: { shooting_in_progress: true },
  });

  revalidatePath('/videos');
  revalidatePath('/tasks');
  revalidatePath('/tasks/calendar');
  revalidatePath('/dashboard');
  return actionOk();
}

export async function postponeVideoShootingAction(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return actionError('Non authentifié.');
  const empErr = assertEmployeeActive(ctx);
  if (empErr) return actionError(empErr);

  const id = String(formData.get('video_id') ?? '').trim();
  if (!id || !UUID_RE.test(id)) return actionError('Identifiant vidéo invalide.');

  const preset = String(formData.get('reason_preset') ?? '').trim();
  const detail = String(formData.get('reason_detail') ?? '').trim();
  const internalNote = String(formData.get('internal_note') ?? '').trim();
  const newShootRaw = String(formData.get('new_shooting_at') ?? '').trim();
  if (!preset) return actionError('Le motif du report est requis.');
  if (!newShootRaw) return actionError('La nouvelle date de tournage est requise.');

  const newShootMs = Date.parse(newShootRaw);
  if (Number.isNaN(newShootMs)) return actionError('Date de tournage invalide.');
  const dateCheck = validateOperationalFutureDate(newShootRaw, { allowEmpty: false, mode: 'datetime' });
  if (!dateCheck.ok) return actionError(dateCheck.message);
  const newShootingAt = new Date(newShootMs).toISOString();

  const reasonLabel = labelForPostponePreset(preset, detail);
  if (!reasonLabel.trim()) return actionError('Précisez le motif du report.');
  if (preset === 'autre' && !detail.trim()) return actionError('Précisez le motif (champ libre).');

  const userSb = await createClient();
  if (!(await assertVideoRecordVisible(userSb, ctx, id))) {
    return actionError('Vidéo introuvable ou accès refusé.');
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return actionError('Configuration serveur incomplète.');
  }

  const v = await loadVideoForShooting(admin, id);
  if (!v) return actionError('Vidéo introuvable.');

  const now = new Date();
  if (!videoCanPostponeShooting(v, now)) {
    return actionError('Cette vidéo ne nécessite plus de confirmation de tournage.');
  }

  const { cameramen, cameraman_id } = await attachCameramen(admin, v);
  if (!viewerCanRespondToShootingConfirmation(ctx.role, ctx.employee?.id, { cameramen, cameraman_id })) {
    return actionError('Vous n’êtes pas autorisé à reporter ce tournage.');
  }

  const postponedAt = now.toISOString();
  const oldShoot = v.shooting_date;

  const { error: upErr } = await admin
    .from('videos')
    .update({
      status: 'shooting_planned' as VideoStatus,
      shooting_date: newShootingAt,
      shooting_postponed_at: postponedAt,
      shooting_postponed_reason: reasonLabel,
      shooting_postponed_note: internalNote || null,
      updated_at: postponedAt,
    })
    .eq('id', id);

  if (upErr) {
    console.error('[postponeVideoShootingAction]', upErr);
    return actionError(formatVideoShootingActionError(upErr));
  }

  try {
    await admin.from('video_shooting_events').insert({
      video_id: id,
      event_type: 'postponed',
      old_shooting_at: oldShoot,
      new_shooting_at: newShootingAt,
      reason: reasonLabel,
      note: internalNote || null,
      created_by: ctx.userId,
    });
  } catch (e) {
    console.error('[postponeVideoShootingAction] event', e);
  }

  const newShootFr = new Date(newShootingAt).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const noteFr = `Tournage reporté : ${reasonLabel}. Nouvelle date : ${newShootFr}.`;
  try {
    await appendNoteToVideoProductionTask(admin, id, noteFr);
  } catch {
    /* best-effort */
  }

  try {
    await syncVideoLinkedProductionTaskFromDb(admin, id);
  } catch {
    /* best-effort */
  }

  const base = appBaseUrl();
  const editorIds = await collectEditorEmployeeIds(admin, id, v.editor_id);
  const camIds = await collectCameramanEmployeeIds(admin, id, v.cameraman_id);
  const notifyEmp = new Set<string>([...editorIds, ...camIds]);

  const rows: NotificationInsert[] = [];
  const recipientSeen = new Set<string>();
  const pushRow = (recipient_user_id: string, row: NotificationInsert) => {
    if (recipientSeen.has(recipient_user_id)) return;
    recipientSeen.add(recipient_user_id);
    rows.push(row);
  };

  for (const empId of notifyEmp) {
    const uid = await getEmployeeUserId(empId);
    if (uid && uid !== ctx.userId) {
      pushRow(uid, {
        recipient_user_id: uid,
        type: 'system',
        priority: 'normal',
        title: 'Tournage reprogrammé',
        message: `« ${v.title} » — ${noteFr}`,
        related_entity_type: 'video',
        related_entity_id: id,
        link_url: `${base}/videos`,
      });
    }
  }

  const pmAdminIds = await getUserIdsByRoles(['admin', 'project_manager']);
  for (const uid of pmAdminIds) {
    if (uid === ctx.userId) continue;
    pushRow(uid, {
      recipient_user_id: uid,
      type: 'system',
      priority: 'normal',
      title: 'Tournage reprogrammé',
      message: `« ${v.title} » (${v.clients?.name ?? 'Client'}) — ${noteFr}`,
      related_entity_type: 'video',
      related_entity_id: id,
      link_url: `${base}/videos`,
    });
  }
  if (rows.length) await insertNotifications(rows);

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'video',
    entityId: id,
    metadata: { shooting_postponed: true, reason: reasonLabel },
  });

  revalidatePath('/videos');
  revalidatePath('/tasks');
  revalidatePath('/tasks/calendar');
  revalidatePath('/dashboard');
  return actionOk();
}
