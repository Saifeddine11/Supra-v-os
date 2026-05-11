import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { endOfMonth, format, startOfMonth } from 'date-fns';

export async function getMonthlyVideoDeliverySnapshot(clientId: string): Promise<{
  deliveredThisMonth: number;
  quota: number;
}> {
  const admin = createAdminClient();
  const { data: client } = await admin
    .from('clients')
    .select('monthly_video_quota')
    .eq('id', clientId)
    .maybeSingle();

  const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const end = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const { count } = await admin
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .in('status', ['validated', 'published'])
    .not('delivery_deadline', 'is', null)
    .gte('delivery_deadline', start)
    .lte('delivery_deadline', end);

  return {
    deliveredThisMonth: count ?? 0,
    quota: client?.monthly_video_quota ?? 0,
  };
}
