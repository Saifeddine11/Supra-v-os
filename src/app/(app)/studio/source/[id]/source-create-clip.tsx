'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createClipFromRangesAction } from '../../actions';

export function SourceCreateClip({
  sourceId,
  durationMs,
  mode,
}: {
  sourceId: string;
  durationMs: number;
  mode: 'transcript' | 'visual';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const end = Math.min(15000, Math.max(5000, durationMs || 15000));
      const res = await createClipFromRangesAction({
        sourceVideoId: sourceId,
        title: 'Nouveau clip',
        ranges: [{ startMs: 0, endMs: end }],
        origin: mode === 'visual' ? 'visual' : 'manual',
      });
      if (!res.ok || !res.data) throw new Error(res.ok ? 'Échec.' : res.error);
      router.push(`/studio/clip/${res.data.clipId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Création impossible.');
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={create} disabled={busy}>
      <Plus className="h-3.5 w-3.5" /> Nouveau clip
    </Button>
  );
}
