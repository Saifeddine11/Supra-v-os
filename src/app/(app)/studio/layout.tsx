import { enforceRouteAccess } from '@/lib/auth/nav-access';

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  await enforceRouteAccess('/studio');
  return children;
}
