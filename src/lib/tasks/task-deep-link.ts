/** Query pour ouvrir une tâche depuis une alerte ou un lien interne. */
export const TASK_HIGHLIGHT_QUERY_PARAM = 'highlight';

export function hrefTasksOpenDetail(taskId: string): string {
  const p = new URLSearchParams();
  p.set(TASK_HIGHLIGHT_QUERY_PARAM, taskId);
  return `/tasks?${p.toString()}`;
}
