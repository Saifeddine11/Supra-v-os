import { enforceRouteAccess } from '@/lib/auth/nav-access';

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  await enforceRouteAccess('/team');
  return children;
}
