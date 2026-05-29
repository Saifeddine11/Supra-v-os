import { NextResponse } from 'next/server';
import { aiCreateVideoInputSchema } from '@/lib/ai/video-draft-schema';
import { requireStaffAiContext } from '@/lib/ai/require-staff-ai';
import { assertSupaiCapability } from '@/lib/ai/supai-permissions';
import { SUPAI_ERROR_PERMISSION, SUPAI_ERROR_VIDEO_CREATE } from '@/lib/ai/supai-copy';
import { assertCanCreateVideo, videoMutationDenied } from '@/lib/auth/data-scope';
import { createVideoCore } from '@/lib/videos/create-video-core';
import type { TaskPriority, VideoPublicStatus, VideoStatus } from '@/types/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function buildTeamNotes(body: Record<string, unknown>): string | null {
  const parts: string[] = [];
  const editor = typeof body.editorName === 'string' ? body.editorName.trim() : '';
  const cameraman = typeof body.cameramanName === 'string' ? body.cameramanName.trim() : '';
  if (editor) parts.push(`Monteur (à assigner) : ${editor}`);
  if (cameraman) parts.push(`Cadreur (à assigner) : ${cameraman}`);
  return parts.length ? parts.join('\n') : null;
}

export async function POST(request: Request) {
  const auth = await requireStaffAiContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { ctx } = auth;
  const deny = assertSupaiCapability(ctx.supai, 'canUseSupAIConfirmVideoCreation');
  if (deny) {
    return NextResponse.json({ error: deny }, { status: 403 });
  }

  const createDenied = assertCanCreateVideo(ctx);
  if (createDenied || videoMutationDenied(ctx)) {
    return NextResponse.json({ error: SUPAI_ERROR_PERMISSION }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const parsed = aiCreateVideoInputSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0]?.message ?? 'Données invalides.';
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const input = parsed.data;
  const rawBody = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  const result = await createVideoCore(ctx, {
    title: input.title,
    description: input.description ?? null,
    clientId: input.clientId ?? null,
    clientName: input.clientName ?? null,
    subject: input.subject ?? null,
    type: input.type ?? null,
    shootingDateIso: input.shootingDateIso ?? null,
    clientDeliveryDateIso: input.clientDeliveryDateIso ?? null,
    priority: (input.priority ?? 'normal') as TaskPriority,
    productionStatus: (input.productionStatus ?? 'idea') as VideoStatus,
    portalStatus: (input.portalStatus ?? 'topic_proposed') as VideoPublicStatus,
    teamNotes: buildTeamNotes(rawBody),
  });

  if (!result.ok) {
    const status =
      result.error.includes('autorisé') || result.error.includes('rôle') ? 403 : 400;
    const error =
      status === 403
        ? SUPAI_ERROR_PERMISSION
        : result.error.includes('introuvable') ||
            result.error.includes('ambigu') ||
            result.error.includes('requis')
          ? result.error
          : SUPAI_ERROR_VIDEO_CREATE;
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ videoId: result.data?.id });
}
