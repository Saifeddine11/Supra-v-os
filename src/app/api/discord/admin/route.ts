import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageEmployees } from '@/lib/auth/capabilities';
import {
  listDiscordAdminStatus,
  postDiscordTestMessage,
  upsertDiscordChannelRoute,
} from '@/lib/discord/task-discord';
import { TEAM_ASSIGNABLE_ROLES } from '@/types/domain';
import type { UserRole } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return { ok: false as const, res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }
  if (!canManageEmployees(ctx.role)) {
    return { ok: false as const, res: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { ok: true as const };
}

/**
 * Admin-only Discord Phase 1 helpers.
 * GET: routing status (no secrets). POST: test message or upsert a channel route.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const status = await listDiscordAdminStatus();
  return NextResponse.json({
    ok: true,
    ...status,
    routingHelp: {
      matchOrder: [
        'client_id + department_role (most specific)',
        'client_id only (department_role null) — client default',
        'department_role only (client_id null) — department default',
        'both null — global fallback',
      ],
      departmentRoles: TEAM_ASSIGNABLE_ROLES,
      howToCopyChannelId:
        'Discord → Settings → Advanced → Developer Mode, then right-click the channel → Copy Channel ID.',
      howToCopyUserId:
        'Right-click the employee Discord profile → Copy User ID, then save it on /team/[id] (discord_user_id).',
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  let body: {
    action?: string;
    channelId?: string;
    clientId?: string | null;
    departmentRole?: UserRole | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const action = (body.action ?? 'test').trim().toLowerCase();

  if (action === 'test') {
    const result = await postDiscordTestMessage(String(body.channelId ?? ''));
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, action: 'test' });
  }

  if (action === 'upsert_route') {
    const clientRaw = body.clientId;
    const clientId =
      typeof clientRaw === 'string' && clientRaw.trim() ? clientRaw.trim() : null;
    if (clientId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
      return NextResponse.json({ ok: false, error: 'client_id must be a UUID or null.' }, { status: 400 });
    }
    const roleRaw = body.departmentRole;
    const departmentRole =
      typeof roleRaw === 'string' && roleRaw.trim() ? (roleRaw.trim() as UserRole) : null;
    if (departmentRole && !TEAM_ASSIGNABLE_ROLES.includes(departmentRole)) {
      return NextResponse.json(
        { ok: false, error: 'department_role must be a staff role (not client).' },
        { status: 400 },
      );
    }
    const result = await upsertDiscordChannelRoute({
      clientId,
      departmentRole,
      channelId: String(body.channelId ?? ''),
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, action: 'upsert_route', id: result.id });
  }

  return NextResponse.json({ ok: false, error: 'unknown_action' }, { status: 400 });
}
