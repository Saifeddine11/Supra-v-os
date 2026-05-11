'use client';

import { Toaster } from 'sonner';

/**
 * Toasts globaux — position top-right desktop, marges safe-area.
 * Le décalage vertical suit la hauteur réelle de la zone sticky (bannière + topbar)
 * via `var(--critical-toast-top-offset)` définie par `StickyAppHeader`.
 */
export function AppShellToaster() {
  return (
    <Toaster
      theme="system"
      richColors={false}
      closeButton={false}
      expand={false}
      position="top-right"
      gap={10}
      visibleToasts={4}
      className="supra-sonner-toaster"
      offset={{
        top: 'var(--critical-toast-top-offset, 1rem)',
        right: 'max(1rem, env(safe-area-inset-right, 0px))',
      }}
      mobileOffset={{
        top: 'var(--critical-toast-top-offset, 5rem)',
        left: '12px',
        right: '12px',
      }}
      toastOptions={{
        duration: 4500,
        classNames: {
          toast: 'group',
        },
      }}
    />
  );
}
