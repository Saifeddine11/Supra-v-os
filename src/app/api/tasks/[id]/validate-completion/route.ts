import { NextResponse } from 'next/server';
import { createUserClientFromAccessToken } from '@/lib/auth/access-token-client';
import { canManageAllTasks } from '@/lib/auth/capabilities';
import { createAdminClient } from '@/lib/supabase/admin';
import { validatePendingTaskCompletion } from '@/lib/tasks/validate-pending-task-completion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Mobile validation of a task already in `completed_pending_validation`.
 * The app sends the user access token. The service role stays on the server.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 });
  }

  const header = request.headers.get('authorization') ?? '';
  const token = /^Bearer\s+(\S+)/i.exec(header)?.[1] ?? '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authed = await createUserClientFromAccessToken(token);
  if (!authed?.ctx.role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let writeSb = authed.supabase;
  if (canManageAllTasks(authed.ctx.role)) {
    try {
      writeSb = createAdminClient();
    } catch {
      writeSb = authed.supabase;
    }
  }

  const result = await validatePendingTaskCompletion(authed.ctx, authed.supabase, writeSb, id);
  if (!result.ok) {
    const denied = /autoris|réservée|inaccessible|hors de votre pôle/i.test(result.error);
    return NextResponse.json({ error: result.error }, { status: denied ? 403 : 400 });
  }
  return NextResponse.json({ ok: true });
}
