import { cn } from '@/lib/utils/cn';

export interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  trackClassName?: string;
  /** Couleur de la barre (défaut : orange Supra) */
  indicatorClassName?: string;
}

export function ProgressBar({
  value,
  max = 100,
  className,
  trackClassName,
  indicatorClassName,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const overload = pct >= 80;

  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', trackClassName, className)}>
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          overload ? 'bg-destructive/90' : 'bg-gradient-to-r from-supra-600 to-supra-400',
          indicatorClassName
        )}
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
