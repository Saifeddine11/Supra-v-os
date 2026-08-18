import 'server-only';

import type { DiscordChannelRoute, TaskDepartment } from '@/types/database';

export function resolveDiscordChannelId(
  routes: Pick<DiscordChannelRoute, 'client_id' | 'department' | 'discord_channel_id' | 'is_enabled'>[],
  clientId: string | null,
  department: TaskDepartment | null,
): string | null {
  const enabled = routes.filter((r) => r.is_enabled);

  const match = (cid: string | null, dept: TaskDepartment | null) =>
    enabled.find((r) => (r.client_id ?? null) === cid && (r.department ?? null) === dept)
      ?.discord_channel_id ?? null;

  if (clientId && department) {
    const hit = match(clientId, department);
    if (hit) return hit;
  }
  if (clientId) {
    const hit = match(clientId, null);
    if (hit) return hit;
  }
  if (department) {
    const hit = match(null, department);
    if (hit) return hit;
  }
  return match(null, null);
}
