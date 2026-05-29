import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffAiContext } from '@/lib/ai/require-staff-ai';
import { assertSupaiCapability } from '@/lib/ai/supai-permissions';
import { SUPAI_ERROR_PERMISSION } from '@/lib/ai/supai-copy';
import { previewTaskDraftReferences } from '@/lib/tasks/resolve-task-references';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  clientName: z.string().trim().max(160).optional(),
  assigneeName: z.string().trim().max(120).optional(),
});

export async function POST(request: Request) {
  const auth = await requireStaffAiContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { ctx } = auth;
  const deny = assertSupaiCapability(ctx.supai, 'canUseSupAICreateTaskDraft');
  if (deny) {
    return NextResponse.json({ error: deny }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides.' }, { status: 400 });
  }

  const preview = await previewTaskDraftReferences(ctx, parsed.data);
  return NextResponse.json(preview);
}
