import { NextResponse } from 'next/server';
import { validatePortalToken } from '@/lib/portal/validate';
import { createAdminClient } from '@/lib/supabase/admin';
import { appBaseUrl } from '@/lib/cron/app-base-url';
import { notifyFinanceTeam } from '@/lib/notifications/notify';
import type { QuoteStatus } from '@/types/database';
import { logPortalActivity } from '@/lib/portal/notify-staff';
import { getAgencyDisplayCurrencyWithClient } from '@/lib/data/agency-settings-db';
import { formatAgencyMoneyCompact } from '@/lib/money/format-money';
import { clientIpFrom, rateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

type Body = { decision?: string };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const clientId = searchParams.get('clientId')?.trim();

  if (!clientId) {
    return NextResponse.json({ ok: false, error: 'clientId requis.' }, { status: 400 });
  }

  // Anti-bruteforce / anti-replay côté portail : 15 réponses max par minute / IP.
  const ip = clientIpFrom(request);
  const rl = rateLimit({ key: `portal-respond:${ip}:${clientId}`, max: 15, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'Trop de requêtes.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  const validation = await validatePortalToken(clientId, token);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: 'Accès refusé.' }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const decision = String(body.decision ?? '').toLowerCase();
  if (decision !== 'accept' && decision !== 'refuse') {
    return NextResponse.json({ ok: false, error: 'decision doit être accept ou refuse.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: quote, error: qErr } = await admin
    .from('quotes')
    .select('id, client_id, ref, status, visible_to_client, total, currency')
    .eq('id', id)
    .maybeSingle();

  if (qErr || !quote) {
    return NextResponse.json({ ok: false, error: 'Proposition introuvable.' }, { status: 404 });
  }

  if (quote.client_id !== clientId) {
    return NextResponse.json({ ok: false, error: 'Accès refusé.' }, { status: 403 });
  }

  if (!quote.visible_to_client) {
    return NextResponse.json({ ok: false, error: 'Document non disponible.' }, { status: 404 });
  }

  if (quote.status !== 'sent') {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Seules les propositions au statut « Envoyé » peuvent être acceptées ou refusées depuis le portail. Contactez votre interlocuteur.',
      },
      { status: 409 }
    );
  }

  const nextStatus: QuoteStatus = decision === 'accept' ? 'accepted' : 'refused';
  const now = new Date().toISOString();

  const { error: uErr } = await admin
    .from('quotes')
    .update({
      status: nextStatus,
      decided_at: now,
      updated_at: now,
    })
    .eq('id', id);

  if (uErr) {
    return NextResponse.json({ ok: false, error: 'Mise à jour impossible.' }, { status: 500 });
  }

  await logPortalActivity({
    action: nextStatus === 'accepted' ? 'quote_accepted' : 'quote_refused',
    entityType: 'quote',
    entityId: id,
    metadata: { client_id: clientId, ref: quote.ref },
  });

  {
    const base = appBaseUrl();
    const displayCurrency = await getAgencyDisplayCurrencyWithClient(admin);
    const amountLabel = formatAgencyMoneyCompact(Number(quote.total), displayCurrency);
    await notifyFinanceTeam({
      type: nextStatus === 'accepted' ? 'quote_accepted' : 'system',
      priority: nextStatus === 'accepted' ? 'high' : 'normal',
      title:
        nextStatus === 'accepted'
          ? 'Proposition acceptée (portail client)'
          : 'Proposition refusée (portail client)',
      message: `${quote.ref} — ${amountLabel}`,
      relatedEntityType: 'quote',
      relatedEntityId: id,
      linkUrl: `${base}/quotes/${id}`,
    });
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
