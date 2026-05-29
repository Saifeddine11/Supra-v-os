import { NextResponse } from 'next/server';
import { aiCreateTaskInputSchema } from '@/lib/ai/task-draft-schema';
import { requireStaffAiContext } from '@/lib/ai/require-staff-ai';
import { assertSupaiCapability } from '@/lib/ai/supai-permissions';
import { SUPAI_ERROR_PERMISSION, SUPAI_ERROR_TASK_CREATE } from '@/lib/ai/supai-copy';
import { createTaskCore } from '@/lib/tasks/create-task-core';
import { normalizeCreateTaskPayload } from '@/lib/tasks/normalize-create-task-payload';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireStaffAiContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { ctx } = auth;
  const deny = assertSupaiCapability(ctx.supai, 'canUseSupAIConfirmTaskCreation');
  if (deny) {
    return NextResponse.json({ error: deny }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const parsed = aiCreateTaskInputSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0]?.message ?? 'Données invalides.';
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const normalized = await normalizeCreateTaskPayload(ctx, parsed.data);
  if (!normalized.ok) {
    const status =
      normalized.error.includes('autorisé') ||
      normalized.error.includes('introuvable') ||
      normalized.error.includes('ambigu')
        ? 400
        : 400;
    return NextResponse.json({ error: normalized.error }, { status });
  }

  const result = await createTaskCore(ctx, normalized.data!);
  if (!result.ok) {
    const status = result.error.includes('autorisé') ? 403 : 400;
    const error = status === 403 ? SUPAI_ERROR_PERMISSION : SUPAI_ERROR_TASK_CREATE;
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ taskId: result.data?.id });
}
