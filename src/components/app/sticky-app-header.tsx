'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** Exposé en CSS pour positionner le toaster Sonner sous bannière critique + topbar. */
export const CRITICAL_TOAST_TOP_OFFSET_VAR = '--critical-toast-top-offset';

export function StickyAppHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;

    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      const gap = window.innerWidth < 640 ? 10 : 12;
      document.documentElement.style.setProperty(CRITICAL_TOAST_TOP_OFFSET_VAR, `${h + gap}px`);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
      document.documentElement.style.removeProperty(CRITICAL_TOAST_TOP_OFFSET_VAR);
    };
  }, []);

  return (
    <div ref={ref} className="sticky top-0 z-[48]">
      {children}
    </div>
  );
}
