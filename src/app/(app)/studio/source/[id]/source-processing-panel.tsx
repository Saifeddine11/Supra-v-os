'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { SOURCE_STATUS_META, SOURCE_STATUS_ORDER } from '@/lib/studio/constants';
import type { SourceVideoStatus } from '@/types/studio';

interface StatusResponse {
  status: SourceVideoStatus;
  progress: number;
  error: string | null;
  hasTranscript: boolean;
  suggestionCount: number;
  clipCount: number;
}

export function SourceProcessingPanel({
  sourceId,
  initialStatus,
  initialProgress,
  initialError,
}: {
  sourceId: string;
  initialStatus: SourceVideoStatus;
  initialProgress: number;
  initialError: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SourceVideoStatus>(initialStatus);
  const [progress, setProgress] = useState(initialProgress);
  const [error, setError] = useState<string | null>(initialError);
  const prevStatus = useRef(initialStatus);

  const terminal = status === 'ready' || status === 'failed';

  useEffect(() => {
    if (terminal) return;
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/studio/source/${sourceId}/status`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as StatusResponse;
        if (!active) return;
        setStatus(data.status);
        setProgress(data.progress);
        setError(data.error);
        if (data.status !== prevStatus.current) {
          prevStatus.current = data.status;
          router.refresh();
        }
      } catch {
        /* transient — keep polling */
      }
    };
    const interval = setInterval(tick, 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [sourceId, terminal, router]);

  if (status === 'failed') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/35 bg-destructive/10 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
        <div>
          <p className="text-sm font-medium text-destructive">Le traitement a échoué</p>
          {error ? <p className="mt-1 text-xs text-muted-foreground">{error}</p> : null}
        </div>
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-400">
        <Check className="h-4 w-4" /> Vidéo prête — transcription et suggestions disponibles.
      </div>
    );
  }

  const currentIdx = SOURCE_STATUS_ORDER.indexOf(status);

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-background/30 p-4">
      <div className="flex items-center gap-2 text-sm text-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        {SOURCE_STATUS_META[status].label}… <span className="text-muted-foreground">{progress}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>
      <ol className="flex flex-wrap gap-x-4 gap-y-1.5">
        {SOURCE_STATUS_ORDER.filter((s) => s !== 'ready').map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <li
              key={s}
              className={cn(
                'inline-flex items-center gap-1.5 text-xs',
                done ? 'text-emerald-400' : active ? 'text-foreground' : 'text-muted-foreground/60',
              )}
            >
              {done ? (
                <Check className="h-3 w-3" />
              ) : active ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
              {SOURCE_STATUS_META[s].label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
