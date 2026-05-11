'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canDeleteClient, canModifyClients } from '@/lib/auth/capabilities';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import { logStaffActivity } from '@/lib/activity/log-activity';
import { assertClientRecordVisible } from '@/lib/auth/data-scope';
import type { ClientStatus, ContractType } from '@/types/database';
import { getAgencyDisplayCurrency } from '@/lib/data/agency-settings-db';
import { normalizeAgencyCurrency } from '@/lib/money/format-money';
import { isValidClientHex, normalizeHexColor } from '@/lib/ui/client-colors';

function parseServices(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseOptionalDate(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? '').trim();
  return v || null;
}


export async function createClientAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyClients(ctx.role)) {
    return actionError('Droits insuffisants pour créer un client.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionError('Session expirée.');

  const agencyCurrency = await getAgencyDisplayCurrency();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return actionError('Le nom est requis.');

  const sector = String(formData.get('sector') ?? '').trim();
  if (!sector) return actionError('Le secteur est requis.');

  const rawColorHex = String(formData.get('color_hex') ?? '').trim();
  if (rawColorHex && !isValidClientHex(rawColorHex)) {
    return actionError('Couleur : format #RRGGBB invalide.');
  }
  const color_hex = normalizeHexColor(rawColorHex || null);
  const color_label = String(formData.get('color_label') ?? '').trim() || null;

  const status = String(formData.get('status') ?? 'prospect') as ClientStatus;
  const contract_type = String(formData.get('contract_type') ?? 'one_shot') as ContractType;
  const services = parseServices(String(formData.get('services') ?? ''));
  let accountManager = String(formData.get('account_manager_id') ?? '').trim();
  if (ctx.role === 'commercial' && ctx.employee) {
    accountManager = ctx.employee.id;
  }

  const row = {
    name,
    legal_name: String(formData.get('legal_name') ?? '').trim() || null,
    sector,
    status,
    contract_type,
    primary_contact: String(formData.get('primary_contact') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    city: String(formData.get('city') ?? '').trim() || null,
    country: String(formData.get('country') ?? 'Maroc').trim() || 'Maroc',
    services: services.length ? services : [],
    monthly_video_quota: Number(formData.get('monthly_video_quota') ?? 0) || 0,
    monthly_fee: Number(formData.get('monthly_fee') ?? 0) || 0,
    start_date: parseOptionalDate(formData, 'start_date'),
    end_date: parseOptionalDate(formData, 'end_date'),
    currency: normalizeAgencyCurrency(String(formData.get('currency') ?? '').trim() || agencyCurrency),
    notes_internal: String(formData.get('notes_internal') ?? '').trim() || null,
    account_manager_id: accountManager || null,
    color_hex,
    color_label,
    created_by: user.id,
  };

  const { data, error } = await supabase.from('clients').insert(row).select('id').single();
  if (error) return actionError(getPostgrestError(error));
  if (!data?.id) return actionError('Création client sans identifiant.');

  await logStaffActivity(ctx, {
    action: 'created',
    entityType: 'client',
    entityId: data.id,
    metadata: { name },
  });

  revalidatePath('/clients');
  revalidatePath('/dashboard');
  return actionOk({ id: data.id });
}

export async function updateClientAction(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyClients(ctx.role)) {
    return actionError('Droits insuffisants pour modifier ce client.');
  }

  const supabase = await createClient();
  if (!(await assertClientRecordVisible(supabase, ctx, id))) {
    return actionError('Client hors périmètre ou introuvable.');
  }

  const agencyCurrency = await getAgencyDisplayCurrency();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return actionError('Le nom est requis.');
  const sector = String(formData.get('sector') ?? '').trim();
  if (!sector) return actionError('Le secteur est requis.');

  const rawColorHex = String(formData.get('color_hex') ?? '').trim();
  if (rawColorHex && !isValidClientHex(rawColorHex)) {
    return actionError('Couleur : format #RRGGBB invalide.');
  }
  const color_hex = normalizeHexColor(rawColorHex || null);
  const color_label = String(formData.get('color_label') ?? '').trim() || null;

  const status = String(formData.get('status') ?? 'prospect') as ClientStatus;
  const contract_type = String(formData.get('contract_type') ?? 'one_shot') as ContractType;
  const services = parseServices(String(formData.get('services') ?? ''));
  let accountManager = String(formData.get('account_manager_id') ?? '').trim();
  if (ctx.role === 'commercial' && ctx.employee) {
    accountManager = ctx.employee.id;
  }

  const patch = {
    name,
    legal_name: String(formData.get('legal_name') ?? '').trim() || null,
    sector,
    status,
    contract_type,
    primary_contact: String(formData.get('primary_contact') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    city: String(formData.get('city') ?? '').trim() || null,
    country: String(formData.get('country') ?? 'Maroc').trim() || 'Maroc',
    services: services.length ? services : [],
    monthly_video_quota: Number(formData.get('monthly_video_quota') ?? 0) || 0,
    monthly_fee: Number(formData.get('monthly_fee') ?? 0) || 0,
    start_date: parseOptionalDate(formData, 'start_date'),
    end_date: parseOptionalDate(formData, 'end_date'),
    currency: normalizeAgencyCurrency(String(formData.get('currency') ?? '').trim() || agencyCurrency),
    notes_internal: String(formData.get('notes_internal') ?? '').trim() || null,
    account_manager_id: accountManager || null,
    color_hex,
    color_label,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('clients').update(patch).eq('id', id);

  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'updated',
    entityType: 'client',
    entityId: id,
    metadata: { name },
  });

  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  revalidatePath('/dashboard');
  return actionOk();
}

export async function archiveClientAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyClients(ctx.role)) {
    return actionError('Droits insuffisants.');
  }

  const supabase = await createClient();
  if (!(await assertClientRecordVisible(supabase, ctx, id))) {
    return actionError('Client hors périmètre ou introuvable.');
  }

  const { error } = await supabase
    .from('clients')
    .update({ status: 'terminated', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'archived',
    entityType: 'client',
    entityId: id,
  });

  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  revalidatePath('/dashboard');
  return actionOk();
}

export async function deleteClientAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canDeleteClient(ctx.role)) {
    return actionError('Seuls les administrateurs peuvent supprimer définitivement un client.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'deleted',
    entityType: 'client',
    entityId: id,
  });

  revalidatePath('/clients');
  revalidatePath('/dashboard');
  return actionOk();
}
