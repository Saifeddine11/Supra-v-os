import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/permissions';
import {
  getUnreadNotificationsCount,
  listBellPreview,
  listNotificationsCreatedAfter,
} from '@/lib/data/notifications-user';

export const dynamic = 'force-dynamic';

/**
 * Polling cloche : aperçu + compteur + nouveautés depuis `since` (ISO).
 */
export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = new URL(request.url).searchParams.get('since')?.trim();
  try {
    const [unread, preview, fresh] = await Promise.all([
      getUnreadNotificationsCount(ctx),
      listBellPreview(8, ctx),
      since ? listNotificationsCreatedAfter(since, 25, ctx) : Promise.resolve([]),
    ]);
    return NextResponse.json({ unread, preview, fresh });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
