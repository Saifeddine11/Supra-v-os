import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

/** Lien ou bouton visuel type CTA secondaire (contour discret). */
export function ActionButton({
  href,
  children,
  className,
  ...rest
}: { href: string; children: React.ReactNode; className?: string } & React.ComponentProps<'a'>) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-[#1a0703]/80 px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/35 hover:bg-primary/[0.06]',
        className
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}
