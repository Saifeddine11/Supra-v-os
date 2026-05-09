'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { attachVideoToCalendarAction } from './actions';

const selectCls =
  'flex h-9 w-full max-w-[220px] rounded-lg border border-input bg-background px-2 text-xs text-foreground';

export function AttachVideoSelect({
  calendarId,
  videos,
}: {
  calendarId: string;
  videos: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [vid, setVid] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (videos.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select className={selectCls} value={vid} onChange={(e) => setVid(e.target.value)}>
        <option value="">Rattacher une vidéo…</option>
        {videos.map((v) => (
          <option key={v.id} value={v.id}>
            {v.title}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-full"
        disabled={!vid || pending}
        onClick={async () => {
          if (!vid) return;
          setErr(null);
          setPending(true);
          try {
            const res = await attachVideoToCalendarAction(vid, calendarId);
            if (!res.ok) setErr(res.error);
            else {
              setVid('');
              router.refresh();
            }
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? '…' : 'Lier'}
      </Button>
      {err ? <span className="text-xs text-destructive">{err}</span> : null}
    </div>
  );
}
