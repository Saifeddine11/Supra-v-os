import Link from 'next/link';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const actionButtonVariants = cva(
  'inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  {
    variants: {
      variant: {
        /** Supra orange CTA — lisible en clair (fond orange, texte crème/blanc). */
        primary:
          'border border-primary/25 bg-primary font-semibold text-primary-foreground shadow-[0_0_20px_-6px_rgba(255,69,15,0.35)] hover:border-primary/35 hover:bg-primary/90 hover:text-primary-foreground dark:border-primary/30 dark:shadow-[0_0_22px_-6px_rgba(255,69,15,0.24)] dark:hover:bg-primary/88 dark:hover:text-primary-foreground',
        /** Secondaire : clair = fond clair + texte foncé + bordure orange ; sombre = surface sombre + texte clair. */
        secondary:
          'border border-primary/40 bg-background font-medium text-foreground shadow-sm hover:border-primary/55 hover:bg-primary/[0.07] dark:border-primary/45 dark:bg-secondary dark:font-medium dark:text-secondary-foreground dark:shadow-sm dark:hover:border-primary/55 dark:hover:bg-secondary/90 dark:hover:text-secondary-foreground',
      },
    },
    defaultVariants: {
      variant: 'secondary',
    },
  },
);

export type ActionButtonProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
} & VariantProps<typeof actionButtonVariants> &
  Omit<React.ComponentProps<'a'>, 'href' | 'className' | 'children'>;

export function ActionButton({ href, children, className, variant, ...rest }: ActionButtonProps) {
  return (
    <Link href={href} className={cn(actionButtonVariants({ variant }), className)} {...rest}>
      {children}
    </Link>
  );
}
