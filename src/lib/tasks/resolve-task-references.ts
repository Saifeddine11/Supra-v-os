import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { assertClientRecordVisible } from '@/lib/auth/data-scope';
import { actionError, actionOk, type ActionResult } from '@/lib/actions/types';
import { listClients } from '@/lib/data/clients';
import { listEmployeesForSelect } from '@/lib/data/employees';
import { resolveEmployeeAlias } from '@/lib/ai/employee-aliases';
import { resolveClientAlias } from '@/lib/ai/client-aliases';
import type { AliasResolveResult } from '@/lib/ai/name-normalize';

export type ResolveMatch = { id: string; label: string };

export type ResolveReferenceResult =
  | { status: 'none' }
  | {
      status: 'resolved';
      id: string;
      label: string;
      query: string;
      matchedVia?: 'alias' | 'exact_full' | 'exact_first' | 'starts_with' | 'contains';
    }
  | { status: 'not_found'; query: string }
  | { status: 'ambiguous'; query: string; matches: ResolveMatch[] };

function mapAliasResult(result: AliasResolveResult): ResolveReferenceResult {
  if (result.status === 'none') return { status: 'none' };
  if (result.status === 'resolved') {
    return {
      status: 'resolved',
      id: result.id,
      label: result.label,
      query: result.query,
      matchedVia: result.matchedVia,
    };
  }
  if (result.status === 'not_found') {
    return { status: 'not_found', query: result.query };
  }
  return { status: 'ambiguous', query: result.query, matches: result.matches };
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

  const clients = await listClients({}, ctx);
  if (clients.length === 0) return { status: 'not_found', query: name };

  return mapAliasResult(
    resolveClientAlias(
      name,
      clients.map((c) => ({ id: c.id, name: c.name })),
    ),
  );
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

  return mapAliasResult(
    resolveEmployeeAlias(
      query,
      employees.map((e) => ({ id: e.id, full_name: e.full_name })),
    ),
  );
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
