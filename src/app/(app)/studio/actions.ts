'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageStudio, canReviewStudio, canUseStudio } from '@/lib/auth/capabilities';
import {
  acceptSuggestion,
  addComment,
  createClipFromRanges,
  createSourceVideo,
  deleteSourceVideo,
  markSourceUploaded,
  rejectSuggestion,
  replaceClipSegments,
  requestRender,
  resolveComment,
  saveSubtitleCues,
  setClipStatus,
  updateClip,
  updateSubtitleTrackStyle,
} from '@/lib/studio/mutations';
import { isStudioStorageConfigured } from '@/lib/studio/storage';
import { reelCompositionSchema } from '@/remotion/schema';
import { typographyLayersSchema } from '@/remotion/typography';
import type { ClipStatus } from '@/types/studio';

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const contentTypeEnum = z.enum(['podcast', 'interview', 'talking_head', 'client_shoot', 'event']);
const workflowEnum = z.enum(['transcript', 'visual']);
const clipStatusEnum = z.enum([
  'to_process',
  'editing',
  'needs_review',
  'changes_requested',
  'approved',
  'exported',
]);

const rangeSchema = z.object({
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
});

type Guard =
  | { ok: true; ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>> }
  | { ok: false; error: string };

async function requireStudioWriter(): Promise<Guard> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: 'Non authentifié.' };
  if (!canUseStudio(ctx.role)) return { ok: false, error: "Vous n'avez pas accès au Studio." };
  return { ok: true, ctx };
}

// ─── Source videos ────────────────────────────────────────────────────────────
const createSourceSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  title: z.string().min(1).max(200),
  contentType: contentTypeEnum,
  workflowMode: workflowEnum,
  fileName: z.string().min(1).max(260),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string().max(200),
});

export async function createSourceVideoAction(
  input: z.infer<typeof createSourceSchema>,
): Promise<ActionResult<{ id: string; bucket: string; uploadPath: string }>> {
  const guard = await requireStudioWriter();
  if (!guard.ok) return guard;
  if (!isStudioStorageConfigured()) {
    return { ok: false, error: 'Stockage Supabase non configuré (SUPABASE_SERVICE_ROLE_KEY).' };
  }
  const parsed = createSourceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Données invalides.' };

  try {
    const res = await createSourceVideo({
      ...parsed.data,
      createdBy: guard.ctx.userId,
    });
    revalidatePath('/studio');
    return { ok: true, data: res };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Création impossible.' };
  }
}

export async function startProcessingAction(sourceVideoId: string): Promise<ActionResult> {
  const guard = await requireStudioWriter();
  if (!guard.ok) return guard;
  if (!z.string().uuid().safeParse(sourceVideoId).success) {
    return { ok: false, error: 'Identifiant invalide.' };
  }
  try {
    await markSourceUploaded(sourceVideoId);
    revalidatePath('/studio');
    revalidatePath(`/studio/source/${sourceVideoId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Échec du démarrage.' };
  }
}

export async function deleteSourceAction(sourceVideoId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageStudio(ctx.role)) return { ok: false, error: 'Action non autorisée.' };
  try {
    await deleteSourceVideo(sourceVideoId);
    revalidatePath('/studio');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Suppression impossible.' };
  }
}

// ─── AI suggestions → clips ─────────────────────────────────────────────────────
const acceptSuggestionSchema = z.object({
  suggestionId: z.string().uuid(),
  sourceVideoId: z.string().uuid(),
  startMs: z.number().int().nonnegative().optional(),
  endMs: z.number().int().positive().optional(),
  title: z.string().min(1).max(200).optional(),
});

export async function acceptSuggestionAction(
  input: z.infer<typeof acceptSuggestionSchema>,
): Promise<ActionResult<{ clipId: string }>> {
  const guard = await requireStudioWriter();
  if (!guard.ok) return guard;
  const parsed = acceptSuggestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Suggestion invalide.' };
  try {
    const clipId = await acceptSuggestion({
      suggestionId: parsed.data.suggestionId,
      startMs: parsed.data.startMs,
      endMs: parsed.data.endMs,
      title: parsed.data.title,
      createdBy: guard.ctx.userId,
    });
    revalidatePath(`/studio/source/${parsed.data.sourceVideoId}`);
    return { ok: true, data: { clipId } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Création du clip impossible.' };
  }
}

export async function rejectSuggestionAction(
  suggestionId: string,
  sourceVideoId: string,
): Promise<ActionResult> {
  const guard = await requireStudioWriter();
  if (!guard.ok) return guard;
  if (!z.string().uuid().safeParse(suggestionId).success) {
    return { ok: false, error: 'Identifiant invalide.' };
  }
  try {
    await rejectSuggestion(suggestionId);
    revalidatePath(`/studio/source/${sourceVideoId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action impossible.' };
  }
}

const createClipSchema = z.object({
  sourceVideoId: z.string().uuid(),
  title: z.string().min(1).max(200),
  ranges: z.array(rangeSchema).min(1),
  origin: z.enum(['manual', 'visual']),
});

export async function createClipFromRangesAction(
  input: z.infer<typeof createClipSchema>,
): Promise<ActionResult<{ clipId: string }>> {
  const guard = await requireStudioWriter();
  if (!guard.ok) return guard;
  const parsed = createClipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Données invalides.' };
  try {
    const clipId = await createClipFromRanges({
      ...parsed.data,
      createdBy: guard.ctx.userId,
    });
    revalidatePath(`/studio/source/${parsed.data.sourceVideoId}`);
    return { ok: true, data: { clipId } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Création du clip impossible.' };
  }
}

const updateClipSchema = z.object({
  clipId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  crop: z
    .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), scale: z.number().min(1).max(5) })
    .optional(),
  composition: reelCompositionSchema.optional(),
  typography: typographyLayersSchema.optional(),
  subtitleStyle: z.enum(['clean_minimal', 'bold_social', 'word_highlight']).optional(),
  brandKitId: z.string().uuid().nullable().optional(),
  status: clipStatusEnum.optional(),
});

export async function updateClipAction(
  input: z.infer<typeof updateClipSchema>,
): Promise<ActionResult> {
  const guard = await requireStudioWriter();
  if (!guard.ok) return guard;
  const parsed = updateClipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Données invalides.' };
  try {
    const { clipId, ...patch } = parsed.data;
    await updateClip(clipId, patch);
    revalidatePath(`/studio/clip/${clipId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Mise à jour impossible.' };
  }
}

const saveSegmentsSchema = z.object({
  clipId: z.string().uuid(),
  ranges: z.array(rangeSchema).min(1),
});

export async function saveSegmentsAction(
  input: z.infer<typeof saveSegmentsSchema>,
): Promise<ActionResult> {
  const guard = await requireStudioWriter();
  if (!guard.ok) return guard;
  const parsed = saveSegmentsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Données invalides.' };
  try {
    await replaceClipSegments(parsed.data.clipId, parsed.data.ranges);
    revalidatePath(`/studio/clip/${parsed.data.clipId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Enregistrement impossible.' };
  }
}

// ─── Subtitles ────────────────────────────────────────────────────────────────
const cueSchema = z.object({
  start_ms: z.number().int().nonnegative(),
  end_ms: z.number().int().nonnegative(),
  text: z.string(),
  words: z
    .array(z.object({ text: z.string(), start_ms: z.number(), end_ms: z.number() }))
    .default([]),
});

const saveSubsSchema = z.object({
  clipId: z.string().uuid(),
  trackId: z.string().uuid(),
  cues: z.array(cueSchema),
  style: z.enum(['clean_minimal', 'bold_social', 'word_highlight']).optional(),
  styleConfig: z.record(z.unknown()).optional(),
});

export async function saveSubtitlesAction(
  input: z.infer<typeof saveSubsSchema>,
): Promise<ActionResult> {
  const guard = await requireStudioWriter();
  if (!guard.ok) return guard;
  const parsed = saveSubsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Données invalides.' };
  try {
    await saveSubtitleCues(parsed.data.trackId, parsed.data.cues);
    if (parsed.data.style && parsed.data.styleConfig) {
      await updateSubtitleTrackStyle(
        parsed.data.trackId,
        parsed.data.style,
        parsed.data.styleConfig,
      );
    }
    revalidatePath(`/studio/clip/${parsed.data.clipId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Enregistrement impossible.' };
  }
}

// ─── Review ──────────────────────────────────────────────────────────────────
const commentSchema = z.object({
  clipId: z.string().uuid(),
  timestampMs: z.number().int().nonnegative().nullable(),
  body: z.string().min(1).max(2000),
});

export async function addCommentAction(
  input: z.infer<typeof commentSchema>,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canReviewStudio(ctx.role)) return { ok: false, error: 'Action non autorisée.' };
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Commentaire invalide.' };
  try {
    await addComment({
      clipId: parsed.data.clipId,
      authorEmployeeId: ctx.employee?.id ?? null,
      timestampMs: parsed.data.timestampMs,
      body: parsed.data.body,
    });
    revalidatePath(`/studio/clip/${parsed.data.clipId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ajout impossible.' };
  }
}

export async function resolveCommentAction(
  commentId: string,
  clipId: string,
  resolved: boolean,
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canReviewStudio(ctx.role)) return { ok: false, error: 'Action non autorisée.' };
  try {
    await resolveComment(commentId, resolved);
    revalidatePath(`/studio/clip/${clipId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action impossible.' };
  }
}

export async function setClipStatusAction(
  clipId: string,
  status: ClipStatus,
): Promise<ActionResult> {
  const guard = await requireStudioWriter();
  if (!guard.ok) return guard;
  if (!clipStatusEnum.safeParse(status).success) return { ok: false, error: 'Statut invalide.' };
  try {
    await setClipStatus(clipId, status);
    revalidatePath(`/studio/clip/${clipId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Action impossible.' };
  }
}

// ─── Render ──────────────────────────────────────────────────────────────────
export async function requestRenderAction(clipId: string): Promise<ActionResult<{ renderJobId: string }>> {
  const guard = await requireStudioWriter();
  if (!guard.ok) return guard;
  if (!z.string().uuid().safeParse(clipId).success) {
    return { ok: false, error: 'Identifiant invalide.' };
  }
  try {
    const renderJobId = await requestRender(clipId, guard.ctx.employee?.id ?? null);
    revalidatePath(`/studio/clip/${clipId}`);
    return { ok: true, data: { renderJobId } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Lancement du rendu impossible.' };
  }
}
