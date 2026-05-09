'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageProjects } from '@/lib/auth/capabilities';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import type { ProjectStatus, TaskPriority } from '@/types/database';
import { assertCommercialClientChoice, assertProjectIdAccessible } from '@/lib/auth/data-scope';

function num(formData: FormData, key: string, fallback = 0): number {
  const v = Number(formData.get(key));
  return Number.isFinite(v) ? v : fallback;
}

export async function createProjectAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageProjects(ctx.role)) return actionError('Droits insuffisants.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return actionError('Session expirée.');

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return actionError('Le nom du projet est requis.');
  const client_id = String(formData.get('client_id') ?? '').trim();
  if (!client_id) return actionError('Le client est requis.');
  if (!(await assertCommercialClientChoice(supabase, ctx, client_id))) {
    return actionError('Ce client est hors de votre périmètre commercial.');
  }
  const type = String(formData.get('type') ?? 'other').trim() || 'other';
  const status = String(formData.get('status') ?? 'todo') as ProjectStatus;
  const priority = String(formData.get('priority') ?? 'normal') as TaskPriority;
  const lead = String(formData.get('lead_id') ?? '').trim();

  const row = {
    client_id,
    title,
    description: String(formData.get('description') ?? '').trim() || null,
    type,
    status,
    priority,
    progress: Math.min(100, Math.max(0, num(formData, 'progress', 0))),
    lead_id: lead || null,
    start_date: String(formData.get('start_date') ?? '').trim() || null,
    deadline: String(formData.get('deadline') ?? '').trim() || null,
    budget: formData.get('budget') ? num(formData, 'budget') : null,
    notes_internal: String(formData.get('notes_internal') ?? '').trim() || null,
    created_by: user.id,
  };

  const { data, error } = await supabase.from('projects').insert(row).select('id').single();
  if (error) return actionError(getPostgrestError(error));
  if (!data?.id) return actionError('Création impossible.');
  revalidatePath('/projects');
  revalidatePath('/dashboard');
  return actionOk({ id: data.id });
}

export async function updateProjectAction(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageProjects(ctx.role)) return actionError('Droits insuffisants.');

  const supabase = await createClient();
  if (!(await assertProjectIdAccessible(supabase, ctx, id))) {
    return actionError('Projet inaccessible.');
  }

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return actionError('Le nom du projet est requis.');
  const type = String(formData.get('type') ?? 'other').trim() || 'other';
  const status = String(formData.get('status') ?? 'todo') as ProjectStatus;
  const priority = String(formData.get('priority') ?? 'normal') as TaskPriority;
  const lead = String(formData.get('lead_id') ?? '').trim();

  const row = {
    title,
    description: String(formData.get('description') ?? '').trim() || null,
    type,
    status,
    priority,
    progress: Math.min(100, Math.max(0, num(formData, 'progress', 0))),
    lead_id: lead || null,
    start_date: String(formData.get('start_date') ?? '').trim() || null,
    deadline: String(formData.get('deadline') ?? '').trim() || null,
    budget: formData.get('budget') ? num(formData, 'budget') : null,
    notes_internal: String(formData.get('notes_internal') ?? '').trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('projects').update(row).eq('id', id);
  if (error) return actionError(getPostgrestError(error));
  revalidatePath('/projects');
  revalidatePath(`/projects/${id}`);
  revalidatePath('/dashboard');
  return actionOk();
}

export async function archiveProjectAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageProjects(ctx.role)) return actionError('Droits insuffisants.');
  const supabase = await createClient();
  if (!(await assertProjectIdAccessible(supabase, ctx, id))) {
    return actionError('Projet inaccessible.');
  }
  const { error } = await supabase
    .from('projects')
    .update({ status: 'archived' as ProjectStatus, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return actionError(getPostgrestError(error));
  revalidatePath('/projects');
  revalidatePath(`/projects/${id}`);
  return actionOk();
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== 'admin') return actionError('Réservé aux administrateurs.');
  const supabase = await createClient();
  if (!(await assertProjectIdAccessible(supabase, ctx, id))) {
    return actionError('Projet inaccessible.');
  }
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) return actionError(getPostgrestError(error));
  revalidatePath('/projects');
  revalidatePath('/dashboard');
  return actionOk();
}
