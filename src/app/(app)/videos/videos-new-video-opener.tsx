'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Client } from '@/types/database';
import type { VideoAssignEmployeeRow } from '@/lib/data/employees';
import { VideoFormDialog } from './video-form-dialog';

/** Ouvre le formulaire « + Vidéo » quand l’URL contient ?new=video (topbar). */
export function VideosNewVideoOpener({
  clients,
  employees,
}: {
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: VideoAssignEmployeeRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wantOpen = searchParams.get('new') === 'video';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (wantOpen) setOpen(true);
  }, [wantOpen]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && wantOpen) {
      const p = new URLSearchParams(searchParams.toString());
      p.delete('new');
      const qs = p.toString();
      router.replace(qs ? `/videos?${qs}` : '/videos', { scroll: false });
    }
  }

  if (!wantOpen && !open) return null;

  return (
    <VideoFormDialog
      clients={clients}
      employees={employees}
      open={open}
      onOpenChange={handleOpenChange}
    />
  );
}
