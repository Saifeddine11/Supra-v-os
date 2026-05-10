'use client';

import { useEffect } from 'react';
import { format } from 'date-fns';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Sous md, propose la vue « Jour » par défaut (comportement type monday.com mobile). */
export function CalendarMobileDefaultRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('view')) return;
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', 'day');
    if (!params.get('day')) {
      params.set('day', format(new Date(), 'yyyy-MM-dd'));
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  return null;
}
