import { enforceRouteAccess } from '@/lib/auth/nav-access';

export default async function DocumentsLayout({ children }: { children: React.ReactNode }) {
  await enforceRouteAccess('/documents');
  return children;
}
