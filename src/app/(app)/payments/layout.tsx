import { enforceRouteAccess } from '@/lib/auth/nav-access';

export default async function PaymentsLayout({ children }: { children: React.ReactNode }) {
  await enforceRouteAccess('/payments');
  return children;
}
