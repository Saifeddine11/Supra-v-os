import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AuthContext } from '@/lib/auth/permissions';
import { canManageAllTasks } from '@/lib/auth/capabilities';

/**
 * Client d’écriture tâches : service role pour admin / chef de projet (après contrôle RBAC app),
 * sinon client session (RLS). Ne pas exposer la clé service côté client.
 */
export async function resolveTaskMutationClient(ctx: AuthContext): Promise<SupabaseClient> {
  if (canManageAllTasks(ctx.role)) {
    try {
      return createAdminClient();
    } catch (e) {
      console.error(
        '[resolveTaskMutationClient] SUPABASE_SERVICE_ROLE_KEY manquante ou invalide — repli sur session RLS:',
        e,
      );
    }
  }
  return createClient();
}
