/**
 * Public web app links for cross-app click-through (notifications).
 * Uses EXPO_PUBLIC_WEB_APP_URL — a public URL, never a secret.
 */

const DEFAULT_WEB_APP_URL = 'https://app.suprav3.com';

export function webAppBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim();
  if (!raw) return DEFAULT_WEB_APP_URL;
  return raw.replace(/\/+$/, '');
}

/**
 * Web deep link that opens a task detail — same pattern as the web's
 * hrefTasksOpenDetail (src/lib/tasks/task-deep-link.ts): /tasks?highlight=<id>.
 */
export function webTaskLink(taskId: string): string {
  return `${webAppBaseUrl()}/tasks?highlight=${encodeURIComponent(taskId)}`;
}
