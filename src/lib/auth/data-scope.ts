/**
 * Filtrage métier des données par rôle (couche applicative, en complément de la RLS).
 * À utiliser dans les loaders serveur et les actions ; ne remplace pas capabilities / nav-policy.
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthContext } from '@/lib/auth/permissions';
import { canModifyQuotes, canViewInvoices } from '@/lib/auth/capabilities';
import type { Project, UserRole } from '@/types/database';

export type ScopedSupabase = SupabaseClient;

export function effectiveRole(role: UserRole | null): UserRole | null {
  if (!role) return null;
  return role === 'designer' ? 'developer' : role;
}

/** Admin & chef de projet : vision opérationnelle complète sur les entités métier. */
export function hasFullOrgDataAccess(ctx: AuthContext): boolean {
  return ctx.role === 'admin' || ctx.role === 'project_manager';
}

const TASK_SELF_SCOPE_ROLES: UserRole[] = [
  'editor',
  'cameraman',
  'developer',
  'designer',
  'seo',
  'community_manager',
];

export function taskListingDenied(ctx: AuthContext): boolean {
  return ctx.role === 'finance' || ctx.role === 'commercial';
}

/** Création / mise à jour de vidéos : hors périmètre finance et rôles purement projet (dev / SEO). */
export function videoMutationDenied(ctx: AuthContext): boolean {
  if (!ctx.role) return true;
  if (ctx.role === 'finance') return true;
  const er = effectiveRole(ctx.role);
  return er === 'developer' || er === 'seo';
}

export function shouldScopeTasksToAssignee(ctx: AuthContext): boolean {
  const r = effectiveRole(ctx.role);
  return r != null && TASK_SELF_SCOPE_ROLES.includes(r);
}

export async function fetchManagedClientIds(sb: ScopedSupabase, employeeId: string): Promise<string[]> {
  const { data, error } = await sb.from('clients').select('id').eq('account_manager_id', employeeId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id as string);
}

/**
 * Identifiants clients visibles pour le rôle (liste, filtres, validation d’accès détail).
 * Admin / PM / finance : tous. Commercial : portefeuille. Production : clients touchés par vidéos / projets assignés.
 */
export async function resolveVisibleClientIds(
  sb: ScopedSupabase,
  ctx: AuthContext
): Promise<'all' | string[]> {
  if (!ctx.role || !ctx.employee) return [];
  if (hasFullOrgDataAccess(ctx) || ctx.role === 'finance') return 'all';
  if (ctx.role === 'commercial') return fetchManagedClientIds(sb, ctx.employee.id);

  const er = effectiveRole(ctx.role);
  const eid = ctx.employee.id;

  if (er === 'editor' || er === 'cameraman' || er === 'community_manager') {
    const { data, error } = await sb
      .from('videos')
      .select('client_id')
      .or(`editor_id.eq.${eid},cameraman_id.eq.${eid}`);
    if (error) throw new Error(error.message);
    return [...new Set((data ?? []).map((r) => r.client_id).filter(Boolean))] as string[];
  }

  if (er === 'developer') {
    const { data, error } = await sb
      .from('projects')
      .select('client_id')
      .or(`lead_id.eq.${eid},team_ids.cs.{${eid}}`);
    if (error) throw new Error(error.message);
    return [...new Set((data ?? []).map((r) => r.client_id).filter(Boolean))] as string[];
  }

  if (er === 'seo') {
    const { data, error } = await sb
      .from('projects')
      .select('client_id')
      .or(`lead_id.eq.${eid},team_ids.cs.{${eid}}`)
      .ilike('type', '%seo%');
    if (error) throw new Error(error.message);
    return [...new Set((data ?? []).map((r) => r.client_id).filter(Boolean))] as string[];
  }

  return [];
}

export async function assertClientRecordVisible(
  sb: ScopedSupabase,
  ctx: AuthContext,
  clientId: string
): Promise<boolean> {
  const s = await resolveVisibleClientIds(sb, ctx);
  return s === 'all' || s.includes(clientId);
}

export async function projectRowAccessible(
  sb: ScopedSupabase,
  ctx: AuthContext,
  p: Pick<Project, 'client_id' | 'lead_id' | 'team_ids' | 'type'>
): Promise<boolean> {
  if (!ctx.role || !ctx.employee) return false;
  if (hasFullOrgDataAccess(ctx)) return true;
  const empId = ctx.employee.id;

  if (ctx.role === 'commercial') {
    const ids = await fetchManagedClientIds(sb, empId);
    return ids.includes(p.client_id);
  }

  const er = effectiveRole(ctx.role);
  const team = p.team_ids ?? [];
  const inTeam = p.lead_id === empId || team.includes(empId);

  if (er === 'developer') return inTeam;
  if (er === 'seo') return inTeam && (p.type ?? '').toLowerCase().includes('seo');
  return false;
}

export async function assertProjectIdAccessible(
  sb: ScopedSupabase,
  ctx: AuthContext,
  projectId: string
): Promise<boolean> {
  const { data, error } = await sb
    .from('projects')
    .select('client_id, lead_id, team_ids, type')
    .eq('id', projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;
  return projectRowAccessible(sb, ctx, data as Project);
}

export async function assertInvoiceRecordVisible(
  sb: ScopedSupabase,
  ctx: AuthContext,
  clientId: string
): Promise<boolean> {
  if (!canViewInvoices(ctx.role)) return false;
  const s = await resolveVisibleClientIds(sb, ctx);
  return s === 'all' || s.includes(clientId);
}

export async function assertQuoteRecordVisible(
  sb: ScopedSupabase,
  ctx: AuthContext,
  clientId: string
): Promise<boolean> {
  if (!ctx.role || !canModifyQuotes(ctx.role)) return false;
  const s = await resolveVisibleClientIds(sb, ctx);
  return s === 'all' || s.includes(clientId);
}

/** Paiement : cohérent avec la facture / client. */
export async function assertPaymentRecordVisible(
  sb: ScopedSupabase,
  ctx: AuthContext,
  clientId: string | null
): Promise<boolean> {
  if (!clientId) return hasFullOrgDataAccess(ctx) || ctx.role === 'finance';
  return assertInvoiceRecordVisible(sb, ctx, clientId);
}

export async function assertReportRecordVisible(
  sb: ScopedSupabase,
  ctx: AuthContext,
  row: { client_id: string; type: string }
): Promise<boolean> {
  if (!ctx.role) return false;
  if (hasFullOrgDataAccess(ctx) || ctx.role === 'finance') return true;

  const s = await resolveVisibleClientIds(sb, ctx);
  if (s !== 'all' && !s.includes(row.client_id)) return false;

  const er = effectiveRole(ctx.role);
  if (er === 'seo') return row.type === 'seo';
  if (er === 'community_manager') {
    return ['social_media', 'video_production', 'monthly', 'weekly'].includes(row.type);
  }
  if (ctx.role === 'commercial') return true;
  return false;
}

type DocRow = {
  client_id: string | null;
  project_id: string | null;
  video_id: string | null;
};

export async function assertDocumentRecordVisible(
  sb: ScopedSupabase,
  ctx: AuthContext,
  doc: DocRow
): Promise<boolean> {
  if (!ctx.role || !ctx.employee) return false;
  if (hasFullOrgDataAccess(ctx)) return true;

  if (ctx.role === 'commercial') {
    const ids = await fetchManagedClientIds(sb, ctx.employee.id);
    if (doc.client_id && ids.includes(doc.client_id)) return true;
    if (doc.project_id) {
      const { data: p } = await sb.from('projects').select('client_id').eq('id', doc.project_id).maybeSingle();
      return !!(p?.client_id && ids.includes(p.client_id));
    }
    if (doc.video_id) {
      const { data: v } = await sb.from('videos').select('client_id').eq('id', doc.video_id).maybeSingle();
      return !!(v?.client_id && ids.includes(v.client_id));
    }
    return false;
  }

  const er = effectiveRole(ctx.role);
  const empId = ctx.employee.id;

  if (doc.video_id && (er === 'editor' || er === 'cameraman' || er === 'community_manager')) {
    const { data: v } = await sb
      .from('videos')
      .select('editor_id, cameraman_id')
      .eq('id', doc.video_id)
      .maybeSingle();
    if (!v) return false;
    if (er === 'editor') return v.editor_id === empId;
    if (er === 'cameraman') return v.cameraman_id === empId;
    return v.editor_id === empId || v.cameraman_id === empId;
  }

  if (doc.project_id && (er === 'developer' || er === 'seo')) {
    const { data: p } = await sb
      .from('projects')
      .select('client_id, lead_id, team_ids, type')
      .eq('id', doc.project_id)
      .maybeSingle();
    if (!p) return false;
    return projectRowAccessible(sb, ctx, p as Project);
  }

  return false;
}

/** Création projet / facture / devis : commercial limité à ses comptes. */
export async function assertCommercialClientChoice(
  sb: ScopedSupabase,
  ctx: AuthContext,
  clientId: string
): Promise<boolean> {
  if (ctx.role !== 'commercial' || !ctx.employee) return true;
  const ids = await fetchManagedClientIds(sb, ctx.employee.id);
  return ids.includes(clientId);
}

export async function assertTaskRecordVisible(
  sb: ScopedSupabase,
  ctx: AuthContext,
  taskId: string
): Promise<boolean> {
  const { data: t, error } = await sb.from('tasks').select('assignee_id').eq('id', taskId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!t) return false;
  if (hasFullOrgDataAccess(ctx)) return true;
  if (taskListingDenied(ctx)) return false;
  if (shouldScopeTasksToAssignee(ctx)) return t.assignee_id === ctx.employee?.id;
  return true;
}

export async function assertVideoRecordVisible(
  sb: ScopedSupabase,
  ctx: AuthContext,
  videoId: string
): Promise<boolean> {
  const { data: v, error } = await sb
    .from('videos')
    .select('editor_id, cameraman_id, client_id')
    .eq('id', videoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!v) return false;
  if (hasFullOrgDataAccess(ctx)) return true;
  if (ctx.role === 'commercial' && ctx.employee) {
    const ids = await fetchManagedClientIds(sb, ctx.employee.id);
    return ids.includes(v.client_id);
  }
  const er = effectiveRole(ctx.role);
  const empId = ctx.employee?.id;
  if (!empId) return false;
  if (er === 'editor') return v.editor_id === empId;
  if (er === 'cameraman') return v.cameraman_id === empId;
  if (er === 'community_manager') return v.editor_id === empId || v.cameraman_id === empId;
  return false;
}
