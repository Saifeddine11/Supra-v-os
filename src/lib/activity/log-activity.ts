import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';

const META_DENY = /token|password|secret|service_role|api_key|authorization/i;

function sanitizeMeta(metadata?: Record<string, unknown>): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (META_DENY.test(k)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Insert an audit row as the current Supabase Auth user (RLS: authenticated insert).
 * Do not pass secrets in metadata.
 */
export async function logActivity(opts: {
  actorUserId: string | null;
  actorLabel: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('activity_logs').insert({
      actor_user_id: opts.actorUserId,
      actor_label: opts.actorLabel,
      action: opts.action,
      entity_type: opts.entityType,
      entity_id: opts.entityId ?? null,
      metadata: sanitizeMeta(opts.metadata),
    });
  } catch {
    /* never break calling action */
  }
}

export async function logStaffActivity(
  ctx: AuthContext | null | undefined,
  opts: {
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  if (!ctx?.userId) return;
  const label = ctx.employee?.full_name?.trim() || ctx.email || null;
  await logActivity({
    actorUserId: ctx.userId,
    actorLabel: label,
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId,
    metadata: opts.metadata,
  });
}
