'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageEmployees } from '@/lib/auth/capabilities';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import { logStaffActivity } from '@/lib/activity/log-activity';
import type { UserRole } from '@/types/database';
import { OPERATIONAL_SKILL_ROLES, ROLE_LABELS, TEAM_ASSIGNABLE_ROLES } from '@/types/domain';
import {
  normalizeOperationalSkills,
  parseOperationalSkillsFromForm,
} from '@/lib/employees/operational-skills';
import {
  assertLastActiveAdminNotRemoved,
  countActiveAdminsExcluding,
  employeeHasBlockingRelations,
} from '@/lib/data/employee-guards';
import { inviteEmployeeAuth } from '@/lib/employees/auth-provision';

function parseAssignableRole(raw: string): UserRole | null {
  const r = raw.trim() as UserRole;
  return TEAM_ASSIGNABLE_ROLES.includes(r) ? r : null;
}

function initialsFromName(name: string, explicit?: string | null): string {
  const t = (explicit ?? '').trim();
  if (t) return t.slice(0, 4).toUpperCase();
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function caughtActionError(e: unknown): ActionResult<never> {
  console.error('[team/actions]', e);
  return actionError(
    e instanceof Error ? e.message : 'Une erreur inattendue est survenue.',
  );
}

export async function createEmployeeAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; authNotice?: string }>> {
  try {
  const ctx = await getAuthContext();
  if (!ctx || !canManageEmployees(ctx.role)) {
    return actionError('Réservé aux administrateurs.');
  }

  const full_name = String(formData.get('full_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const role = parseAssignableRole(String(formData.get('role') ?? ''));
  const weekly_capacity = Math.max(1, Math.min(80, Number(formData.get('weekly_capacity') ?? 40) || 40));
  const avatar_initials_raw = String(formData.get('avatar_initials') ?? '').trim();
  const avatar_initials = initialsFromName(full_name, avatar_initials_raw || null);
  const notes_internal = String(formData.get('notes_internal') ?? '').trim() || null;
  const is_active = String(formData.get('is_active') ?? 'true') !== 'false';
  const invite_auth = String(formData.get('invite_auth') ?? '') === 'on';

  if (!full_name) return actionError('Le nom est requis.');
  if (!email) return actionError('L’e-mail est requis.');
  if (!role) return actionError('Rôle invalide.');

  let operational_skills = parseOperationalSkillsFromForm(formData);
  if (operational_skills.length === 0 && OPERATIONAL_SKILL_ROLES.includes(role)) {
    operational_skills = normalizeOperationalSkills([role]);
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('employees')
    .insert({
      full_name,
      email,
      phone,
      role,
      operational_skills,
      weekly_capacity,
      avatar_initials,
      is_active,
      notes_internal,
      user_id: null,
    })
    .select('id')
    .single();

  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'employee_created',
    entityType: 'employee',
    entityId: data.id,
    metadata: { full_name, email, role, operational_skills, invite_auth_requested: invite_auth },
  });

  let authNotice: string | undefined;
  if (invite_auth) {
    try {
      const ir = await inviteEmployeeAuth(data.id, email);
      if (ir.ok) {
        authNotice =
          ir.mode === 'linked_existing'
            ? 'Compte Auth existant : profil lié.'
            : 'Invitation envoyée. Compte Auth lié.';
        await logStaffActivity(ctx, {
          action: ir.mode === 'linked_existing' ? 'employee_auth_linked' : 'employee_auth_invite_sent',
          entityType: 'employee',
          entityId: data.id,
          metadata: { full_name, email, mode: ir.mode },
        });
      } else {
        authNotice = `Auth : ${ir.error}`;
        await logStaffActivity(ctx, {
          action: 'employee_auth_invite_failed',
          entityType: 'employee',
          entityId: data.id,
          metadata: { full_name, email, reason: ir.error },
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'erreur inconnue';
      authNotice =
        'Le profil est créé, mais l’étape Auth a échoué (vérifiez SUPABASE_SERVICE_ROLE_KEY et la configuration e-mail).';
      await logStaffActivity(ctx, {
        action: 'employee_auth_invite_failed',
        entityType: 'employee',
        entityId: data.id,
        metadata: { full_name, email, reason: msg },
      });
    }
  }

  revalidatePath('/team');
  revalidatePath(`/team/${data.id}`);
  return actionOk({ id: data.id, authNotice });
  } catch (e) {
    return caughtActionError(e);
  }
}

export async function updateEmployeeSkillsAction(
  employeeId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
  const ctx = await getAuthContext();
  if (!ctx || !canManageEmployees(ctx.role)) {
    return actionError('Réservé aux administrateurs.');
  }

  const next = parseOperationalSkillsFromForm(formData);
  const supabase = await createClient();
  const { data: prev, error: pErr } = await supabase
    .from('employees')
    .select('operational_skills, full_name')
    .eq('id', employeeId)
    .maybeSingle();
  if (pErr) return actionError(getPostgrestError(pErr));
  if (!prev) return actionError('Collaborateur introuvable.');

  const oldSkills = (prev.operational_skills ?? []) as UserRole[];

  const { error } = await supabase
    .from('employees')
    .update({
      operational_skills: next,
      updated_at: new Date().toISOString(),
    })
    .eq('id', employeeId);

  if (error) return actionError(getPostgrestError(error));

  const prevSorted = [...oldSkills].sort();
  const nextSorted = [...next].sort();
  const same =
    prevSorted.length === nextSorted.length && prevSorted.every((s, i) => s === nextSorted[i]);
  if (!same) {
    await logStaffActivity(ctx, {
      action: 'employee_skills_changed',
      entityType: 'employee',
      entityId: employeeId,
      metadata: {
        employee_name: prev.full_name,
        old_skills: oldSkills,
        new_skills: next,
        actor_user_id: ctx.userId,
      },
    });
  }

  revalidatePath('/team');
  revalidatePath(`/team/${employeeId}`);
  return actionOk();
  } catch (e) {
    return caughtActionError(e);
  }
}

export async function updateEmployeeAdminAction(employeeId: string, formData: FormData): Promise<ActionResult> {
  try {
  const ctx = await getAuthContext();
  if (!ctx || !canManageEmployees(ctx.role)) {
    return actionError('Réservé aux administrateurs.');
  }

  const supabase = await createClient();
  const { data: cur, error: curErr } = await supabase
    .from('employees')
    .select('user_id, email, role, is_active, archived_at, operational_skills')
    .eq('id', employeeId)
    .maybeSingle();
  if (curErr) return actionError(getPostgrestError(curErr));
  if (!cur) return actionError('Collaborateur introuvable.');

  const full_name = String(formData.get('full_name') ?? '').trim();
  const emailNext = String(formData.get('email') ?? '').trim().toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const weekly_capacity = Math.max(1, Math.min(80, Number(formData.get('weekly_capacity') ?? 35) || 35));
  const notes_internal = String(formData.get('notes_internal') ?? '').trim() || null;
  const is_active = String(formData.get('is_active') ?? 'true') === 'true';
  const avatar_initials_raw = String(formData.get('avatar_initials') ?? '').trim();
  const avatar_initials = initialsFromName(full_name || 'X', avatar_initials_raw || null);
  const discordRaw = String(formData.get('discord_user_id') ?? '').trim();
  let discord_user_id: string | null = null;
  if (discordRaw) {
    if (!/^[0-9]{17,20}$/.test(discordRaw)) {
      return actionError('ID Discord invalide : 17 à 20 chiffres (mode développeur Discord).');
    }
    discord_user_id = discordRaw;
  }

  if (!full_name) return actionError('Le nom est requis.');
  if (!emailNext) return actionError('L’e-mail est requis.');

  if (cur.user_id && emailNext !== cur.email) {
    return actionError(
      'Compte Auth lié : modifiez l’e-mail dans Supabase Auth ou déliez le compte avant de changer l’e-mail ici.',
    );
  }

  const guard = await assertLastActiveAdminNotRemoved(
    supabase,
    employeeId,
    cur.role,
    is_active,
    cur.archived_at,
  );
  if (!guard.ok) return guard;

  const { error } = await supabase
    .from('employees')
    .update({
      full_name,
      email: emailNext,
      phone,
      weekly_capacity,
      notes_internal,
      is_active,
      avatar_initials,
      discord_user_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', employeeId);

  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'employee_updated',
    entityType: 'employee',
    entityId: employeeId,
    metadata: {
      full_name,
      email: emailNext,
      is_active,
      operational_skills: (cur.operational_skills ?? []) as UserRole[],
    },
  });

  revalidatePath('/team');
  revalidatePath(`/team/${employeeId}`);
  return actionOk();
  } catch (e) {
    return caughtActionError(e);
  }
}

export async function changeEmployeeRoleAction(
  employeeId: string,
  newRoleRaw: string,
  opts?: { confirmPromoteAdmin?: boolean; confirmDemoteAdmin?: boolean },
): Promise<ActionResult> {
  try {
  const ctx = await getAuthContext();
  if (!ctx || !canManageEmployees(ctx.role)) {
    return actionError('Réservé aux administrateurs.');
  }

  const newRole = parseAssignableRole(newRoleRaw);
  if (!newRole) return actionError('Rôle invalide.');

  const supabase = await createClient();
  const { data: cur, error: curErr } = await supabase
    .from('employees')
    .select('role, full_name, is_active, archived_at')
    .eq('id', employeeId)
    .maybeSingle();
  if (curErr) return actionError(getPostgrestError(curErr));
  if (!cur) return actionError('Collaborateur introuvable.');

  if (cur.role === newRole) return actionOk();

  if (newRole === 'admin' && cur.role !== 'admin' && !opts?.confirmPromoteAdmin) {
    return actionError('Confirmation requise pour nommer administrateur.', 'CONFIRM_PROMOTE_ADMIN');
  }
  if (cur.role === 'admin' && newRole !== 'admin' && !opts?.confirmDemoteAdmin) {
    return actionError('Confirmation requise pour retirer le rôle administrateur.', 'CONFIRM_DEMOTE_ADMIN');
  }

  const lastAdmin = await assertLastActiveAdminNotRemoved(
    supabase,
    employeeId,
    newRole,
    cur.is_active,
    cur.archived_at,
  );
  if (!lastAdmin.ok) return lastAdmin;

  const { error } = await supabase
    .from('employees')
    .update({
      role: newRole,
      updated_at: new Date().toISOString(),
    })
    .eq('id', employeeId);

  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'employee_role_changed',
    entityType: 'employee',
    entityId: employeeId,
    metadata: {
      employee_name: cur.full_name,
      old_role: cur.role,
      old_role_label: ROLE_LABELS[cur.role as UserRole],
      new_role: newRole,
      new_role_label: ROLE_LABELS[newRole],
    },
  });

  revalidatePath('/team');
  revalidatePath(`/team/${employeeId}`);
  return actionOk();
  } catch (e) {
    return caughtActionError(e);
  }
}

export async function setEmployeeActiveAction(employeeId: string, active: boolean): Promise<ActionResult> {
  try {
  const ctx = await getAuthContext();
  if (!ctx || !canManageEmployees(ctx.role)) {
    return actionError('Réservé aux administrateurs.');
  }

  const supabase = await createClient();
  const { data: cur, error: curErr } = await supabase
    .from('employees')
    .select('role, is_active, archived_at, full_name')
    .eq('id', employeeId)
    .maybeSingle();
  if (curErr) return actionError(getPostgrestError(curErr));
  if (!cur) return actionError('Collaborateur introuvable.');

  if (cur.is_active === active) return actionOk();

  const guard = await assertLastActiveAdminNotRemoved(supabase, employeeId, cur.role, active, cur.archived_at);
  if (!guard.ok) return guard;

  const { error } = await supabase
    .from('employees')
    .update({
      is_active: active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', employeeId);

  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: active ? 'employee_reactivated' : 'employee_disabled',
    entityType: 'employee',
    entityId: employeeId,
    metadata: { full_name: cur.full_name, is_active: active },
  });

  revalidatePath('/team');
  revalidatePath(`/team/${employeeId}`);
  return actionOk();
  } catch (e) {
    return caughtActionError(e);
  }
}

export async function archiveEmployeeAction(employeeId: string): Promise<ActionResult> {
  try {
  const ctx = await getAuthContext();
  if (!ctx || !canManageEmployees(ctx.role)) {
    return actionError('Réservé aux administrateurs.');
  }

  const supabase = await createClient();
  const { data: cur, error: curErr } = await supabase
    .from('employees')
    .select('role, archived_at, full_name, is_active')
    .eq('id', employeeId)
    .maybeSingle();
  if (curErr) return actionError(getPostgrestError(curErr));
  if (!cur) return actionError('Collaborateur introuvable.');
  if (cur.archived_at) return actionOk();

  const nextArchived = new Date().toISOString();
  const lastAdmin = await assertLastActiveAdminNotRemoved(
    supabase,
    employeeId,
    cur.role,
    false,
    nextArchived,
  );
  if (!lastAdmin.ok) return lastAdmin;

  const archivedAt = nextArchived;
  const { error } = await supabase
    .from('employees')
    .update({
      archived_at: archivedAt,
      is_active: false,
      updated_at: archivedAt,
    })
    .eq('id', employeeId);

  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'employee_archived',
    entityType: 'employee',
    entityId: employeeId,
    metadata: { full_name: cur.full_name },
  });

  revalidatePath('/team');
  revalidatePath(`/team/${employeeId}`);
  return actionOk();
  } catch (e) {
    return caughtActionError(e);
  }
}

export async function unarchiveEmployeeAction(employeeId: string): Promise<ActionResult> {
  try {
  const ctx = await getAuthContext();
  if (!ctx || !canManageEmployees(ctx.role)) {
    return actionError('Réservé aux administrateurs.');
  }

  const supabase = await createClient();
  const { data: cur, error: curErr } = await supabase
    .from('employees')
    .select('archived_at, full_name')
    .eq('id', employeeId)
    .maybeSingle();
  if (curErr) return actionError(getPostgrestError(curErr));
  if (!cur) return actionError('Collaborateur introuvable.');
  if (!cur.archived_at) return actionOk();

  const { error } = await supabase
    .from('employees')
    .update({
      archived_at: null,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', employeeId);

  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'employee_unarchived',
    entityType: 'employee',
    entityId: employeeId,
    metadata: { full_name: cur.full_name },
  });

  revalidatePath('/team');
  revalidatePath(`/team/${employeeId}`);
  return actionOk();
  } catch (e) {
    return caughtActionError(e);
  }
}

export async function deleteEmployeeAction(
  employeeId: string,
): Promise<ActionResult<{ archivedInstead?: true }>> {
  try {
  const ctx = await getAuthContext();
  if (!ctx || !canManageEmployees(ctx.role)) {
    return actionError('Réservé aux administrateurs.');
  }

  const supabase = await createClient();
  const { data: cur, error: curErr } = await supabase
    .from('employees')
    .select('id, role, full_name, is_active, archived_at')
    .eq('id', employeeId)
    .maybeSingle();
  if (curErr) return actionError(getPostgrestError(curErr));
  if (!cur) return actionError('Collaborateur introuvable.');

  if (cur.role === 'admin') {
    const n = await countActiveAdminsExcluding(supabase, employeeId);
    if (n < 1) {
      return actionError('Impossible de supprimer le dernier administrateur actif.');
    }
  }

  const hasRelations = await employeeHasBlockingRelations(supabase, employeeId);
  if (hasRelations) {
    const arch = await archiveEmployeeAction(employeeId);
    if (!arch.ok) return arch;
    return actionOk({ archivedInstead: true as const });
  }

  const { error } = await supabase.from('employees').delete().eq('id', employeeId);
  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'employee_deleted',
    entityType: 'employee',
    entityId: employeeId,
    metadata: { full_name: cur.full_name },
  });

  revalidatePath('/team');
  return actionOk();
  } catch (e) {
    return caughtActionError(e);
  }
}
