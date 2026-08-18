import 'server-only';

import type { DiscordChannelRoute, UserRole } from '@/types/database';

export function resolveDiscordChannelId(
  routes: Pick<DiscordChannelRoute, 'client_id' | 'department_role' | 'discord_channel_id' | 'is_enabled'>[],
  clientId: string | null,
  departmentRole: UserRole | null,
): string | null {
  const enabled = routes.filter((r) => r.is_enabled);

  const match = (cid: string | null, role: UserRole | null) =>
    enabled.find((r) => (r.client_id ?? null) === cid && (r.department_role ?? null) === role)
      ?.discord_channel_id ?? null;

  if (clientId && departmentRole) {
    const hit = match(clientId, departmentRole);
    if (hit) return hit;
  }
  if (clientId) {
    const hit = match(clientId, null);
    if (hit) return hit;
  }
  if (departmentRole) {
    const hit = match(null, departmentRole);
    if (hit) return hit;
  }
  return match(null, null);
}
