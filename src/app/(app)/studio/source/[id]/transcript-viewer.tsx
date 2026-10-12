'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { msToTimecode } from '@/lib/studio/time';

interface Seg {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
}

export function TranscriptViewer({ segments }: { segments: Seg[] }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return segments;
    return segments.filter((s) => s.text.toLowerCase().includes(needle));
  }, [q, segments]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="border-border/70 bg-background/40 pl-9"
          placeholder="Rechercher dans la transcription…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
        {filtered.map((s) => (
          <div
            key={s.id}
            className="flex gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-foreground/5"
          >
            <span className="shrink-0 pt-0.5 font-mono text-xs text-primary/80">
              {msToTimecode(s.start_ms, false)}
            </span>
            <span className="text-foreground/90">{s.text}</span>
          </div>
        ))}
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">Aucun résultat.</p>
        ) : null}
      </div>
    </div>
  );
}
