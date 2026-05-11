/** Query utilisée pour ouvrir `VideoDetailDialog` depuis une navigation (ex. tâche liée). */
export const VIDEO_DEEP_LINK_QUERY_PARAM = 'videoId';

export function hrefVideosOpenDetail(videoId: string): string {
  const p = new URLSearchParams();
  p.set(VIDEO_DEEP_LINK_QUERY_PARAM, videoId);
  return `/videos?${p.toString()}`;
}
