'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageClientUserAccess } from '@/lib/auth/capabilities';
import { actionError, actionOk, type ActionResult } from '@/lib/actions/types';
import { logStaffActivity } from '@/lib/activity/log-activity';
import { sendAuthPasswordResetEmail } from '@/lib/employees/auth-provision';
import {
  ClientUsersTableMissingError,
  clientLoginHint,
  getClientUserOrThrow,
  listClientUsersForClient,
  markClientUserMustChangePassword,
  provisionClientUserAccess,
  setClientUserActiveStatus,
} from '@/lib/clients/auth-provision';
import type { ClientUser } from '@/types/database';

function deny(): ActionResult<never> {
  return actionError('Réservé aux administrateurs et chefs de projet.');
}

function mapProvisionError(e: unknown): ActionResult<never> {
  if (e instanceof ClientUsersTableMissingError) {
    return actionError(e.message, 'PHASE0_MISSING');
  }
  return actionError(e instanceof Error ? e.message : 'Une erreur inattendue est survenue.');
}

async function requireClientAccessManager() {
  const ctx = await getAuthContext();
  if (!ctx || !canManageClientUserAccess(ctx.role)) return { ok: false as const };
  return { ok: true as const, ctx };
}

export async function listClientUsers(clientId: string): Promise<ActionResult<ClientUser[]>> {
  const gate = await requireClientAccessManager();
  if (!gate.ok) return deny();

  try {
    const users = await listClientUsersForClient(clientId);
    return actionOk(users);
  } catch (e) {
    return mapProvisionError(e);
  }
}

export type CreateClientAccessResult =
  | {
      mode: 'invited';
      message: string;
      email: string;
      clientUserId: string;
    }
  | {
      mode: 'temp_password';
      message: string;
      email: string;
      clientUserId: string;
      temporaryPassword: string;
      loginUrl: string;
    };

export async function createClientUserAccess(
  clientId: string,
  fullName: string,
  email: string,
  passwordMode: 'invite' | 'temporary' = 'invite',
): Promise<ActionResult<CreateClientAccessResult>> {
  const gate = await requireClientAccessManager();
  if (!gate.ok) return deny();

  try {
    const result = await provisionClientUserAccess({
      clientId,
      fullName,
      email,
      createdByUserId: gate.ctx.userId,
      passwordMode,
    });

    await logStaffActivity(gate.ctx, {
      action: result.invited ? 'client_user_invite_sent' : 'client_user_account_created',
      entityType: 'client_user',
      entityId: result.clientUser.id,
      metadata: {
        client_id: clientId,
        email: result.clientUser.email,
        mode: result.invited ? 'invite' : 'temporary',
      },
    });

    revalidatePath(`/clients/${clientId}`);

    if (result.invited) {
      return actionOk({
        mode: 'invited',
        message:
          'Invitation envoyée. Le lien ouvre la définition du mot de passe. Le tableau de bord client n’est pas encore disponible.',
        email: result.clientUser.email,
        clientUserId: result.clientUser.id,
      });
    }

    return actionOk({
      mode: 'temp_password',
      message: 'Compte client créé avec un mot de passe temporaire.',
      email: result.clientUser.email,
      clientUserId: result.clientUser.id,
      temporaryPassword: result.temporaryPassword ?? '',
      loginUrl: clientLoginHint(),
    });
  } catch (e) {
    console.error('[createClientUserAccess]', e);
    await logStaffActivity(gate.ctx, {
      action: 'client_user_create_failed',
      entityType: 'client',
      entityId: clientId,
      metadata: { reason: e instanceof Error ? e.message : 'unknown' },
    });
    return mapProvisionError(e);
  }
}

export async function resetClientUserPassword(clientUserId: string): Promise<ActionResult> {
  const gate = await requireClientAccessManager();
  if (!gate.ok) return deny();

  try {
    const row = await getClientUserOrThrow(clientUserId);
    if (!row.is_active) {
      return actionError('Réactivez l’accès avant d’envoyer une réinitialisation.');
    }

    const sent = await sendAuthPasswordResetEmail(row.email);
    if (!sent.ok) {
      await logStaffActivity(gate.ctx, {
        action: 'client_user_password_reset_failed',
        entityType: 'client_user',
        entityId: clientUserId,
        metadata: { reason: sent.error, client_id: row.client_id },
      });
      return actionError(sent.error);
    }

    await markClientUserMustChangePassword(clientUserId);
    await logStaffActivity(gate.ctx, {
      action: 'client_user_password_reset_sent',
      entityType: 'client_user',
      entityId: clientUserId,
      metadata: { client_id: row.client_id, email: row.email },
    });

    revalidatePath(`/clients/${row.client_id}`);
    return actionOk();
  } catch (e) {
    console.error('[resetClientUserPassword]', e);
    return mapProvisionError(e);
  }
}

export async function setClientUserActive(
  clientUserId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const gate = await requireClientAccessManager();
  if (!gate.ok) return deny();

  try {
    const row = await setClientUserActiveStatus(clientUserId, isActive);
    await logStaffActivity(gate.ctx, {
      action: isActive ? 'client_user_reactivated' : 'client_user_deactivated',
      entityType: 'client_user',
      entityId: clientUserId,
      metadata: { client_id: row.client_id, email: row.email },
    });
    revalidatePath(`/clients/${row.client_id}`);
    return actionOk();
  } catch (e) {
    console.error('[setClientUserActive]', e);
    return mapProvisionError(e);
  }
}
