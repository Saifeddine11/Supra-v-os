import { enforceRouteAccess } from '@/lib/auth/nav-access';

export default async function TasksLayout({ children }: { children: React.ReactNode }) {
  await enforceRouteAccess('/tasks');
  return children;
}
