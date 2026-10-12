import { cn } from '@/lib/utils/cn';
import { CLIP_STATUS_META, SOURCE_STATUS_META } from '@/lib/studio/constants';
import type { ClipStatus, SourceVideoStatus } from '@/types/studio';

type Tone = 'muted' | 'info' | 'warn' | 'success' | 'danger';

const TONE_CLASS: Record<Tone, string> = {
  muted: 'border-border/60 bg-background/40 text-muted-foreground',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  warn: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  danger: 'border-destructive/35 bg-destructive/10 text-destructive',
};

export function StatusPill({
  tone,
  label,
  pulse,
  className,
}: {
  tone: Tone;
  label: string;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASS[tone],
        className,
      )}
    >
      {pulse ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> : null}
      {label}
    </span>
  );
}

export function SourceStatusPill({ status, className }: { status: SourceVideoStatus; className?: string }) {
  const meta = SOURCE_STATUS_META[status];
  return <StatusPill tone={meta.tone} label={meta.label} pulse={!meta.terminal} className={className} />;
}

export function ClipStatusPill({ status, className }: { status: ClipStatus; className?: string }) {
  const meta = CLIP_STATUS_META[status];
  return <StatusPill tone={meta.tone} label={meta.label} className={className} />;
}
