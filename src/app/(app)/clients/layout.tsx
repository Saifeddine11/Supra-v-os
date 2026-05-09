import { enforceRouteAccess } from '@/lib/auth/nav-access';

export default async function ClientsLayout({ children }: { children: React.ReactNode }) {
  await enforceRouteAccess('/clients');
  return children;
}
