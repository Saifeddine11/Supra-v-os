import { enforceRouteAccess } from '@/lib/auth/nav-access';

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  await enforceRouteAccess('/projects');
  return children;
}
