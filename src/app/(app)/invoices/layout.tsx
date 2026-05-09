import { enforceRouteAccess } from '@/lib/auth/nav-access';

export default async function InvoicesLayout({ children }: { children: React.ReactNode }) {
  await enforceRouteAccess('/invoices');
  return children;
}
