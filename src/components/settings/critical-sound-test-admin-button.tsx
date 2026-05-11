'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { playCriticalSoundAdminTest } from '@/lib/notifications/notification-sound';

/**
 * Admin / section technique : joue notification-critical (MP3 ou WAV) à volume 1.0.
 */
export function CriticalSoundTestAdminButton() {
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-lg border border-destructive/35 bg-destructive/[0.06] p-3">
      <p className="text-xs font-medium text-foreground">Son critique (test)</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Joue <code className="text-[10px]">/sounds/notification-critical.mp3</code> puis le WAV de secours si besoin.
        Utile pour valider le volume et le déblocage audio du navigateur.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2 border-destructive/40"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          try {
            playCriticalSoundAdminTest();
          } finally {
            window.setTimeout(() => setBusy(false), 4500);
          }
        }}
      >
        {busy ? 'Lecture…' : 'Tester le son critique'}
      </Button>
    </div>
  );
}
