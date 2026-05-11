import 'server-only';

import { appBaseUrl } from '@/lib/cron/app-base-url';
import { getEmployeeUserId, insertNotifications } from '@/lib/notifications/notify';

const base = () => appBaseUrl();

export async function notifyTaskAssigned(assigneeEmployeeId: string | null, taskId: string, title: string) {
  const uid = await getEmployeeUserId(assigneeEmployeeId);
  if (!uid) return;
  await insertNotifications([
    {
      recipient_user_id: uid,
      type: 'task_assigned',
      priority: 'normal',
      title: 'Nouvelle tâche assignée',
      message: title,
      related_entity_type: 'task',
      related_entity_id: taskId,
      link_url: `${base()}/tasks`,
    },
  ]);
}

/** Notifie chaque employé une fois (multi-assignation). */
export async function notifyTaskAssignees(employeeIds: string[], taskId: string, title: string) {
  const seen = new Set<string>();
  for (const empId of employeeIds) {
    if (!empId || seen.has(empId)) continue;
    seen.add(empId);
    await notifyTaskAssigned(empId, taskId, title);
  }
}

export async function notifyTaskBlocked(
  assigneeEmployeeIds: string[],
  taskId: string,
  title: string,
) {
  const seen = new Set<string>();
  for (const empId of assigneeEmployeeIds) {
    if (!empId || seen.has(empId)) continue;
    seen.add(empId);
    const uid = await getEmployeeUserId(empId);
    if (!uid) continue;
    await insertNotifications([
      {
        recipient_user_id: uid,
        type: 'system',
        priority: 'high',
        title: 'Tâche bloquée',
        message: title,
        related_entity_type: 'task',
        related_entity_id: taskId,
        link_url: `${base()}/tasks`,
      },
    ]);
  }
}
