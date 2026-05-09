import { cn } from '@/lib/utils/cn';

export interface UserAvatarProps {
  name: string;
  initials?: string | null;
  color?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  name,
  initials: initialsProp,
  color,
  size = 'md',
  className,
}: UserAvatarProps) {
  const initials = initialsProp?.trim() || initialsFromName(name);
  const bg = color || 'hsl(14 55% 32%)';

  const sizes = {
    sm: 'h-8 w-8 text-[10px]',
    md: 'h-10 w-10 text-xs',
    lg: 'h-12 w-12 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight text-foreground ring-1 ring-border/60',
        sizes[size],
        className
      )}
      style={{ backgroundColor: bg }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
