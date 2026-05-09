import { enforceRouteAccess } from '@/lib/auth/nav-access';

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await enforceRouteAccess('/reports');
  return children;
}
