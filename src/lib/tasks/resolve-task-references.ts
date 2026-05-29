import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { assertClientRecordVisible } from '@/lib/auth/data-scope';
import { actionError, actionOk, type ActionResult } from '@/lib/actions/types';
import { listClients } from '@/lib/data/clients';
import { listEmployeesForSelect } from '@/lib/data/employees';

export type ResolveMatch = { id: string; label: string };

export type ResolveReferenceResult =
  | { status: 'none' }
  | { status: 'resolved'; id: string; label: string }
  | { status: 'not_found'; query: string }
  | { status: 'ambiguous'; query: string; matches: ResolveMatch[] };

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function firstNameOf(fullName: string): string {
  return normalizeName(fullName).split(/\s+/)[0] ?? '';
}

export async function resolveClientForTask(
  ctx: AuthContext,
  clientId?: string | null,
  clientName?: string | null,
): Promise<ActionResult<{ id: string; label: string }>> {
  const supabase = await createClient();

  if (clientId?.trim()) {
    const id = clientId.trim();
    if (!(await assertClientRecordVisible(supabase, ctx, id))) {
      return actionError('Client non autorisé pour cette tâche.');
    }
    const { data } = await supabase.from('clients').select('name').eq('id', id).maybeSingle();
    return actionOk({ id, label: String(data?.name ?? 'Client') });
  }

  const name = clientName?.trim();
  if (!name) {
    return actionOk({ id: '', label: '' });
  }

  const preview = await previewClientResolution(ctx, name);
  if (preview.status === 'resolved') {
    return actionOk({ id: preview.id, label: preview.label });
  }
  if (preview.status === 'not_found') {
    return actionError(`Client introuvable : ${name}`);
  }
  if (preview.status === 'ambiguous') {
    const names = preview.matches.map((m) => m.label).join(', ');
    return actionError(
      `Client ambigu : ${name} (${preview.matches.length} résultats — ${names}).`,
    );
  }

  return actionError(`Client introuvable : ${name}`);
}

export async function previewClientResolution(
  ctx: AuthContext,
  clientName: string,
): Promise<ResolveReferenceResult> {
  const name = clientName.trim();
  if (!name) return { status: 'none' };

  const matches = await listClients({ search: name }, ctx);
  if (matches.length === 0) return { status: 'not_found', query: name };

  const normalized = normalizeName(name);
  const exact = matches.filter((m) => normalizeName(m.name) === normalized);
  if (exact.length === 1) {
    return { status: 'resolved', id: exact[0].id, label: exact[0].name };
  }
  if (exact.length > 1) {
    return {
      status: 'ambiguous',
      query: name,
      matches: exact.map((m) => ({ id: m.id, label: m.name })),
    };
  }

  const wordStart = matches.filter((m) => {
    const n = normalizeName(m.name);
    return n.startsWith(normalized) || n.split(/\s+/).some((w) => w.startsWith(normalized));
  });
  if (wordStart.length === 1) {
    return { status: 'resolved', id: wordStart[0].id, label: wordStart[0].name };
  }
  if (wordStart.length > 1) {
    return {
      status: 'ambiguous',
      query: name,
      matches: wordStart.slice(0, 5).map((m) => ({ id: m.id, label: m.name })),
    };
  }

  if (matches.length === 1) {
    return { status: 'resolved', id: matches[0].id, label: matches[0].name };
  }

  return {
    status: 'ambiguous',
    query: name,
    matches: matches.slice(0, 5).map((m) => ({ id: m.id, label: m.name })),
  };
}

export async function resolveAssigneeForTask(
  ctx: AuthContext,
  assigneeIds?: string[],
  assigneeName?: string | null,
): Promise<ActionResult<{ ids: string[]; label?: string }>> {
  const ids = [...new Set((assigneeIds ?? []).map((x) => x.trim()).filter(Boolean))];
  if (ids.length > 0) {
    return actionOk({ ids });
  }

  const name = assigneeName?.trim();
  if (!name) {
    return actionOk({ ids: [] });
  }

  const preview = await previewAssigneeResolution(ctx, name);
  if (preview.status === 'resolved') {
    return actionOk({ ids: [preview.id], label: preview.label });
  }
  if (preview.status === 'not_found') {
    return actionError(`Assigné introuvable : ${name}`);
  }
  if (preview.status === 'ambiguous') {
    const names = preview.matches.map((m) => m.label).join(', ');
    return actionError(
      `Assigné ambigu : ${name} (${preview.matches.length} résultats — ${names}).`,
    );
  }

  return actionOk({ ids: [] });
}

export async function previewAssigneeResolution(
  ctx: AuthContext,
  assigneeName: string,
): Promise<ResolveReferenceResult> {
  const query = assigneeName.trim();
  if (!query) return { status: 'none' };

  const employees = await listEmployeesForSelect(ctx);
  if (employees.length === 0) return { status: 'not_found', query };

  const normalized = normalizeName(query);
  const exact = employees.filter((e) => normalizeName(e.full_name) === normalized);
  if (exact.length === 1) {
    return { status: 'resolved', id: exact[0].id, label: exact[0].full_name };
  }
  if (exact.length > 1) {
    return {
      status: 'ambiguous',
      query,
      matches: exact.map((e) => ({ id: e.id, label: e.full_name })),
    };
  }

  const firstNameMatches = employees.filter((e) => firstNameOf(e.full_name) === normalized);
  if (firstNameMatches.length === 1) {
    return {
      status: 'resolved',
      id: firstNameMatches[0].id,
      label: firstNameMatches[0].full_name,
    };
  }
  if (firstNameMatches.length > 1) {
    return {
      status: 'ambiguous',
      query,
      matches: firstNameMatches.map((e) => ({ id: e.id, label: e.full_name })),
    };
  }

  const contains = employees.filter((e) => normalizeName(e.full_name).includes(normalized));
  if (contains.length === 1) {
    return { status: 'resolved', id: contains[0].id, label: contains[0].full_name };
  }
  if (contains.length > 1) {
    return {
      status: 'ambiguous',
      query,
      matches: contains.slice(0, 5).map((e) => ({ id: e.id, label: e.full_name })),
    };
  }

  return { status: 'not_found', query };
}

export type TaskDraftResolutionPreview = {
  client: ResolveReferenceResult;
  assignee: ResolveReferenceResult;
};

export async function previewTaskDraftReferences(
  ctx: AuthContext,
  input: { clientName?: string | null; assigneeName?: string | null },
): Promise<TaskDraftResolutionPreview> {
  const [client, assignee] = await Promise.all([
    input.clientName?.trim()
      ? previewClientResolution(ctx, input.clientName)
      : Promise.resolve({ status: 'none' } as ResolveReferenceResult),
    input.assigneeName?.trim()
      ? previewAssigneeResolution(ctx, input.assigneeName)
      : Promise.resolve({ status: 'none' } as ResolveReferenceResult),
  ]);
  return { client, assignee };
}
