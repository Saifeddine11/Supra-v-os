'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';

function checkboxTrue(formData: FormData, name: string): boolean {
  return formData.getAll(name).includes('true');
}

export async function updateAgencySettingsAction(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== 'admin') {
    return actionError('Seuls les administrateurs peuvent modifier les paramètres agence.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('agency_settings')
    .update({
      agency_name: String(formData.get('agency_name') ?? '').trim() || null,
      logo_url: String(formData.get('logo_url') ?? '').trim() || null,
      email: String(formData.get('email') ?? '').trim() || null,
      phone: String(formData.get('phone') ?? '').trim() || null,
      address: String(formData.get('address') ?? '').trim() || null,
      website: String(formData.get('website') ?? '').trim() || null,
      tax_id: String(formData.get('tax_id') ?? '').trim() || null,
      invoice_prefix: String(formData.get('invoice_prefix') ?? '').trim() || 'FAC-',
      quote_prefix: String(formData.get('quote_prefix') ?? '').trim() || 'DEV-',
      default_currency: String(formData.get('default_currency') ?? '').trim() || 'MAD',
      default_payment_terms: String(formData.get('default_payment_terms') ?? '').trim() || null,
      default_tax_rate: Number(formData.get('default_tax_rate') ?? '') || 0,
      portal_base_url: String(formData.get('portal_base_url') ?? '').trim() || null,
      portal_show_branding: checkboxTrue(formData, 'portal_show_branding'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  if (error) return actionError(getPostgrestError(error));
  revalidatePath('/settings');
  return actionOk();
}

export async function updateNotificationPreferencesAction(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx?.userId) return actionError('Session expirée.');

  const supabase = await createClient();
  const row = {
    user_id: ctx.userId,
    email_reminders_enabled: checkboxTrue(formData, 'email_reminders_enabled'),
    morning_reminder_enabled: checkboxTrue(formData, 'morning_reminder_enabled'),
    evening_summary_enabled: checkboxTrue(formData, 'evening_summary_enabled'),
    deadline_alerts_enabled: checkboxTrue(formData, 'deadline_alerts_enabled'),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('user_notification_preferences').upsert(row, { onConflict: 'user_id' });
  if (error) return actionError(getPostgrestError(error));
  revalidatePath('/settings');
  return actionOk();
}
