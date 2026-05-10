'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Redirige vers /change-password tant que employees.must_change_password est true.
 * Logique côté client (pathname) pour éviter le middleware Edge + requête employé.
 */
export function StaffPasswordChangeGate({
  mustChangePassword,
  children,
}: {
  mustChangePassword: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!mustChangePassword) return;
    if (pathname === '/change-password') return;
    router.replace('/change-password');
  }, [mustChangePassword, pathname, router]);

  return <>{children}</>;
}
