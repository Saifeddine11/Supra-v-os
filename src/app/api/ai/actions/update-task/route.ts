import { NextResponse } from 'next/server';
import { requireStaffAiContext } from '@/lib/ai/require-staff-ai';
import { assertSupaiCapability } from '@/lib/ai/supai-permissions';
import { SUPAI_REFUSAL_TASK_UPDATE } from '@/lib/ai/supai-copy';
import { aiUpdateTaskInputSchema } from '@/lib/ai/task-update-draft-schema';
import { normalizeUpdateTaskPayload } from '@/lib/tasks/normalize-update-task-payload';
import { updateTaskCore } from '@/lib/tasks/update-task-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireStaffAiContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { ctx } = auth;
  const deny = assertSupaiCapability(ctx.supai, 'canUseSupAIConfirmTaskUpdate');
  if (deny) {
    return NextResponse.json({ error: SUPAI_REFUSAL_TASK_UPDATE }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const parsed = aiUpdateTaskInputSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0]?.message ?? 'Données invalides.';
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const normalized = await normalizeUpdateTaskPayload(ctx, parsed.data);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const result = await updateTaskCore(ctx, normalized.data!);
  if (!result.ok) {
    const status = result.error.includes('autorisé') ? 403 : 400;
    return NextResponse.json(
      { error: status === 403 ? SUPAI_REFUSAL_TASK_UPDATE : result.error },
      { status },
    );
  }

  return NextResponse.json({ taskId: result.data?.id });
}
