import { enforceRouteAccess } from '@/lib/auth/nav-access';

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  await enforceRouteAccess('/internal');
  return children;
}
