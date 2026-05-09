'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canManageProjects } from '@/lib/auth/capabilities';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import type { InternalPriority, ProjectStatus } from '@/types/database';

function num(formData: FormData, key: string, fallback = 0): number {
  const v = Number(formData.get(key));
  return Number.isFinite(v) ? v : fallback;
}

export async function createInternalProjectAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageProjects(ctx.role)) return actionError('Droits insuffisants.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return actionError('Session expirée.');

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return actionError('Le titre est requis.');
  const status = String(formData.get('status') ?? 'todo') as ProjectStatus;
  const priority = String(formData.get('priority') ?? 'normal') as InternalPriority;
  const owner = String(formData.get('owner_id') ?? '').trim();

  const row = {
    title,
    description: String(formData.get('description') ?? '').trim() || null,
    category: String(formData.get('category') ?? '').trim() || null,
    status,
    priority,
    progress: Math.min(100, Math.max(0, num(formData, 'progress', 0))),
    owner_id: owner || null,
    start_date: String(formData.get('start_date') ?? '').trim() || null,
    deadline: String(formData.get('deadline') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
    created_by: user.id,
  };

  const { data, error } = await supabase.from('internal_projects').insert(row).select('id').single();
  if (error) return actionError(getPostgrestError(error));
  if (!data?.id) return actionError('Création impossible.');
  revalidatePath('/internal');
  revalidatePath('/dashboard');
  return actionOk({ id: data.id });
}

export async function updateInternalProjectAction(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageProjects(ctx.role)) return actionError('Droits insuffisants.');

  const supabase = await createClient();
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return actionError('Le titre est requis.');
  const status = String(formData.get('status') ?? 'todo') as ProjectStatus;
  const priority = String(formData.get('priority') ?? 'normal') as InternalPriority;
  const owner = String(formData.get('owner_id') ?? '').trim();

  const row = {
    title,
    description: String(formData.get('description') ?? '').trim() || null,
    category: String(formData.get('category') ?? '').trim() || null,
    status,
    priority,
    progress: Math.min(100, Math.max(0, num(formData, 'progress', 0))),
    owner_id: owner || null,
    start_date: String(formData.get('start_date') ?? '').trim() || null,
    deadline: String(formData.get('deadline') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('internal_projects').update(row).eq('id', id);
  if (error) return actionError(getPostgrestError(error));
  revalidatePath('/internal');
  revalidatePath(`/internal/${id}`);
  return actionOk();
}

export async function archiveInternalProjectAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canManageProjects(ctx.role)) return actionError('Droits insuffisants.');
  const supabase = await createClient();
  const { error } = await supabase
    .from('internal_projects')
    .update({ status: 'archived' as ProjectStatus, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return actionError(getPostgrestError(error));
  revalidatePath('/internal');
  revalidatePath(`/internal/${id}`);
  return actionOk();
}

export async function deleteInternalProjectAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== 'admin') return actionError('Réservé aux administrateurs.');
  const supabase = await createClient();
  const { error } = await supabase.from('internal_projects').delete().eq('id', id);
  if (error) return actionError(getPostgrestError(error));
  revalidatePath('/internal');
  return actionOk();
}
