'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageEmployees } from '@/lib/auth/capabilities';
import { actionError, actionOk, type ActionResult } from '@/lib/actions/types';
import { logStaffActivity } from '@/lib/activity/log-activity';
import {
  createEmployeeAuthWithTempPassword,
  inviteEmployeeAuth,
  sendAuthPasswordResetEmail,
} from '@/lib/employees/auth-provision';

async function loadEmployeeAuthTarget(employeeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('employees')
    .select('id, email, user_id, full_name')
    .eq('id', employeeId)
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: 'Collaborateur introuvable.' };
  return { ok: true as const, employee: data };
}

export async function inviteEmployeeAuthAction(
  employeeId: string,
): Promise<ActionResult<{ mode: 'invited' | 'linked_existing' }>> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageEmployees(ctx.role)) {
    return actionError('Réservé aux administrateurs.');
  }

  const row = await loadEmployeeAuthTarget(employeeId);
  if (!row.ok) return actionError(row.error);

  if (row.employee.user_id) {
    return actionError('Compte Auth déjà lié.');
  }
  if (!row.employee.email?.trim()) {
    return actionError(
      'Cet employé n’a pas d’e-mail. Ajoutez un e-mail avant d’envoyer une invitation.',
    );
  }

  try {
    const r = await inviteEmployeeAuth(employeeId, row.employee.email);
    if (!r.ok) {
      await logStaffActivity(ctx, {
        action: 'employee_auth_invite_failed',
        entityType: 'employee',
        entityId: employeeId,
        metadata: { reason: r.error, employee_name: row.employee.full_name },
      });
      return actionError(r.error);
    }

    await logStaffActivity(ctx, {
      action: r.mode === 'linked_existing' ? 'employee_auth_linked' : 'employee_auth_invite_sent',
      entityType: 'employee',
      entityId: employeeId,
      metadata: {
        employee_name: row.employee.full_name,
        mode: r.mode,
      },
    });

    revalidatePath('/team');
    revalidatePath(`/team/${employeeId}`);
    return actionOk({ mode: r.mode });
  } catch (e) {
    console.error('[inviteEmployeeAuthAction]', e);
    return actionError(e instanceof Error ? e.message : 'Impossible d’envoyer l’invitation.');
  }
}

export type CreateAuthUserResult =
  | {
      mode: 'temp_password';
      message: string;
      temporaryPassword: string;
      email: string;
      userId: string;
    }
  | {
      mode: 'linked_existing';
      message: string;
      email: string;
      userId: string;
    };

export async function createAuthUserForEmployeeAction(
  employeeId: string,
): Promise<ActionResult<CreateAuthUserResult>> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageEmployees(ctx.role)) {
    return actionError('Réservé aux administrateurs.');
  }

  const row = await loadEmployeeAuthTarget(employeeId);
  if (!row.ok) return actionError(row.error);

  if (row.employee.user_id) {
    return actionError('Compte Auth déjà lié.');
  }
  if (!row.employee.email?.trim()) {
    return actionError(
      'Cet employé n’a pas d’e-mail. Ajoutez un e-mail avant de créer le compte.',
    );
  }

  const email = row.employee.email.trim();

  try {
    const r = await createEmployeeAuthWithTempPassword(employeeId, email);
    if (!r.ok) {
      await logStaffActivity(ctx, {
        action: 'employee_auth_create_failed',
        entityType: 'employee',
        entityId: employeeId,
        metadata: { reason: r.error, employee_name: row.employee.full_name },
      });
      return actionError(r.error);
    }

    revalidatePath('/team');
    revalidatePath(`/team/${employeeId}`);

    if (r.mode === 'linked_existing') {
      await logStaffActivity(ctx, {
        action: 'employee_auth_linked',
        entityType: 'employee',
        entityId: employeeId,
        metadata: {
          employee_name: row.employee.full_name,
          note: 'existing_auth_user_linked',
        },
      });
      return actionOk({
        mode: 'linked_existing',
        message:
          'Un compte Auth existait déjà pour cet e-mail : le profil employé a été lié. Demandez au collaborateur d’utiliser « Mot de passe oublié » sur la page de connexion si besoin.',
        email,
        userId: r.userId,
      });
    }

    await logStaffActivity(ctx, {
      action: 'employee_auth_account_created',
      entityType: 'employee',
      entityId: employeeId,
      metadata: {
        employee_name: row.employee.full_name,
      },
    });

    return actionOk({
      mode: 'temp_password',
      message: 'Compte créé avec succès',
      temporaryPassword: r.temporaryPassword,
      email,
      userId: r.userId,
    });
  } catch (e) {
    console.error('[createAuthUserForEmployeeAction]', e);
    return actionError(e instanceof Error ? e.message : 'Création du compte impossible.');
  }
}

export async function sendEmployeePasswordResetAction(employeeId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageEmployees(ctx.role)) {
    return actionError('Réservé aux administrateurs.');
  }

  const row = await loadEmployeeAuthTarget(employeeId);
  if (!row.ok) return actionError(row.error);

  if (!row.employee.user_id) {
    return actionError('Aucun compte Auth lié : utilisez d’abord l’invitation ou la création de compte.');
  }
  if (!row.employee.email?.trim()) {
    return actionError('Cet employé n’a pas d’e-mail.');
  }

  try {
    const r = await sendAuthPasswordResetEmail(row.employee.email);
    if (!r.ok) {
      await logStaffActivity(ctx, {
        action: 'employee_auth_password_reset_failed',
        entityType: 'employee',
        entityId: employeeId,
        metadata: { reason: r.error, employee_name: row.employee.full_name },
      });
      return actionError(r.error);
    }

    await logStaffActivity(ctx, {
      action: 'employee_auth_password_reset_sent',
      entityType: 'employee',
      entityId: employeeId,
      metadata: { employee_name: row.employee.full_name },
    });

    revalidatePath('/team');
    revalidatePath(`/team/${employeeId}`);
    return actionOk();
  } catch (e) {
    console.error('[sendEmployeePasswordResetAction]', e);
    return actionError(e instanceof Error ? e.message : 'Impossible d’envoyer la réinitialisation.');
  }
}
