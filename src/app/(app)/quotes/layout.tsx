import { enforceRouteAccess } from '@/lib/auth/nav-access';

export default async function QuotesLayout({ children }: { children: React.ReactNode }) {
  await enforceRouteAccess('/quotes');
  return children;
}
