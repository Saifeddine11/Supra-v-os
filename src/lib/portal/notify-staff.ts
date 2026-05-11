import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

export { notifyAdminsAndPMs } from '@/lib/notifications/notify';

export async function logPortalActivity(opts: {
  action: string;
  entityType: string;
  entityId: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from('activity_logs').insert({
    actor_user_id: null,
    actor_label: 'Client portal',
    action: opts.action,
    entity_type: opts.entityType,
    entity_id: opts.entityId,
    metadata: opts.metadata ?? {},
  });
}
