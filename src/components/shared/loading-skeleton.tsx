import { cn } from '@/lib/utils/cn';

export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      aria-hidden
    />
  );
}
