import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import type { StatusBlockTone } from '@/lib/ui/status-block-tone';
import { getStatusBlockSurface, getStatusIconBox } from '@/lib/ui/status-block-tone';

export type StatusBlockProps<T extends ElementType = 'div'> = {
  as?: T;
  tone: StatusBlockTone;
  /** Glow discret — seulement pertinent avec tone danger (retard / bloqué). */
  urgentGlow?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Bloc sémantique (carte / panneau) : clair = fond pastel + accent gauche ;
 * sombre = surface `card` + bordures / anneau intérieur discrets (pas de gros pastels).
 */
export function StatusBlock<T extends ElementType = 'div'>({
  as,
  tone,
  urgentGlow,
  children,
  className,
}: StatusBlockProps<T>) {
  const Comp = (as ?? 'div') as ElementType;
  return (
    <Comp className={cn(getStatusBlockSurface(tone, { urgentGlow }), className)}>{children}</Comp>
  );
}

export function StatusIconBox({
  tone,
  children,
  className,
}: {
  tone: StatusBlockTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
        getStatusIconBox(tone),
        className,
      )}
    >
      {children}
    </span>
  );
}
