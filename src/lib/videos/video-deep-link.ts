/** Query utilisée pour ouvrir `VideoDetailDialog` depuis une navigation (ex. tâche liée). */
export const VIDEO_DEEP_LINK_QUERY_PARAM = 'videoId';

export function hrefVideosOpenDetail(
  videoId: string,
  opts?: { view?: 'kanban' | 'table' },
): string {
  const p = new URLSearchParams();
  p.set(VIDEO_DEEP_LINK_QUERY_PARAM, videoId);
  if (opts?.view) p.set('view', opts.view);
  return `/videos?${p.toString()}`;
}

export function hrefVideosOpenDetailKanban(videoId: string): string {
  return hrefVideosOpenDetail(videoId, { view: 'kanban' });
}
