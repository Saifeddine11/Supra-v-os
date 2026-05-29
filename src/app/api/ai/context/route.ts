import { NextResponse } from 'next/server';
import { aiContextRequestSchema } from '@/lib/ai/context-schema';
import { runAiContextTool } from '@/lib/ai/context-tools';
import { requireStaffAiContext } from '@/lib/ai/require-staff-ai';
import { canRunSupaiContextTool } from '@/lib/ai/supai-permissions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireStaffAiContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const parsed = aiContextRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0]?.message ?? 'Requête invalide.';
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const toolGate = canRunSupaiContextTool(parsed.data, auth.ctx.supai);
  if (!toolGate.ok) {
    return NextResponse.json({ error: toolGate.reason }, { status: 403 });
  }

  try {
    const result = await runAiContextTool(auth.ctx, parsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/ai/context]', e);
    }
    return NextResponse.json(
      { error: 'Impossible de charger le contexte opérationnel.' },
      { status: 500 },
    );
  }
}
