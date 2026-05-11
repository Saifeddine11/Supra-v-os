import { cn } from '@/lib/utils/cn';

export function ClientColorDot({
  hex,
  className,
  title,
  size = 'md',
}: {
  hex: string;
  className?: string;
  title?: string;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  return (
    <span
      title={title}
      className={cn('inline-block shrink-0 rounded-full ring-1 ring-border/45', dim, className)}
      style={{ backgroundColor: hex }}
      aria-hidden={title ? undefined : true}
    />
  );
}
