import 'server-only';

import { getAuthContext, type AuthContext } from '@/lib/auth/permissions';
import { isStaff } from '@/lib/auth/nav-policy';
import { getSupaiPermissions, type SupaiPermissions } from '@/lib/ai/supai-permissions';
import { SUPAI_REFUSAL_PORTAL } from '@/lib/ai/supai-copy';

export type StaffAiContext = AuthContext & {
  employee: NonNullable<AuthContext['employee']>;
  role: NonNullable<AuthContext['role']>;
  supai: SupaiPermissions;
};

export async function requireStaffAiContext(): Promise<
  { ok: true; ctx: StaffAiContext } | { ok: false; status: 401 | 403; error: string }
> {
  const ctx = await getAuthContext();
  if (!ctx?.userId) {
    return { ok: false, status: 401, error: 'Non authentifié.' };
  }
  if (!ctx.employee) {
    return { ok: false, status: 403, error: SUPAI_REFUSAL_PORTAL };
  }
  if (!isStaff(ctx.role)) {
    return { ok: false, status: 403, error: SUPAI_REFUSAL_PORTAL };
  }
  if (!ctx.employee.is_active || ctx.employee.archived_at) {
    return { ok: false, status: 403, error: 'Compte employé inactif.' };
  }

  const supai = getSupaiPermissions(ctx);
  if (!supai.canUseSupAI) {
    return { ok: false, status: 403, error: SUPAI_REFUSAL_PORTAL };
  }

  return {
    ok: true,
    ctx: {
      ...ctx,
      employee: ctx.employee,
      role: ctx.role!,
      supai,
    },
  };
}
