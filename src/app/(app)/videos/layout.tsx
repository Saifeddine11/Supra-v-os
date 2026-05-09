import { enforceRouteAccess } from '@/lib/auth/nav-access';

export default async function VideosLayout({ children }: { children: React.ReactNode }) {
  await enforceRouteAccess('/videos');
  return children;
}
