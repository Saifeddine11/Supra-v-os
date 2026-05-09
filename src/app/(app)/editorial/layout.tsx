import { enforceRouteAccess } from '@/lib/auth/nav-access';

export default async function EditorialLayout({ children }: { children: React.ReactNode }) {
  await enforceRouteAccess('/editorial');
  return children;
}
