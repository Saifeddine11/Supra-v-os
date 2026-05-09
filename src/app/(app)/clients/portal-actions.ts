'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageClientPortal } from '@/lib/auth/capabilities';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import { logStaffActivity } from '@/lib/activity/log-activity';

function newToken(): string {
  return randomBytes(32).toString('hex');
}

export async function ensurePortalWithNewTokenAction(clientId: string): Promise<ActionResult<{ token: string }>> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageClientPortal(ctx.role)) {
    return actionError('Réservé aux administrateurs et chefs de projet.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionError('Session expirée.');

  const token = newToken();
  const { data: existing } = await supabase
    .from('client_portals')
    .select('id')
    .eq('client_id', clientId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from('client_portals')
      .update({
        token,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (error) return actionError(getPostgrestError(error));
    await logStaffActivity(ctx, {
      action: 'portal_token_regenerated',
      entityType: 'client_portal',
      entityId: existing.id,
      metadata: { client_id: clientId },
    });
  } else {
    const { data: created, error } = await supabase
      .from('client_portals')
      .insert({
        client_id: clientId,
        token,
        is_active: true,
        created_by: user.id,
      })
      .select('id')
      .single();
    if (error) return actionError(getPostgrestError(error));
    await logStaffActivity(ctx, {
      action: 'portal_token_generated',
      entityType: 'client_portal',
      entityId: created?.id ?? null,
      metadata: { client_id: clientId },
    });
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/portal-admin');
  return actionOk({ token });
}

export async function setPortalActiveAction(clientId: string, active: boolean): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageClientPortal(ctx.role)) {
    return actionError('Réservé aux administrateurs et chefs de projet.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('client_portals')
    .update({
      is_active: active,
      updated_at: new Date().toISOString(),
    })
    .eq('client_id', clientId);

  if (error) return actionError(getPostgrestError(error));

  const { data: portalRow } = await supabase
    .from('client_portals')
    .select('id')
    .eq('client_id', clientId)
    .maybeSingle();
  await logStaffActivity(ctx, {
    action: active ? 'portal_activated' : 'portal_deactivated',
    entityType: 'client_portal',
    entityId: portalRow?.id ?? null,
    metadata: { client_id: clientId },
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/portal-admin');
  return actionOk();
}
