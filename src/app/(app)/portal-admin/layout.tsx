import { enforceRouteAccess } from '@/lib/auth/nav-access';

export default async function PortalAdminLayout({ children }: { children: React.ReactNode }) {
  await enforceRouteAccess('/portal-admin');
  return children;
}
