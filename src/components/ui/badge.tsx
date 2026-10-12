import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-border/60 bg-background/40 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]',
        primary: 'border-primary/30 bg-primary/15 text-primary',
        outline:
          'border-border/60 bg-background/30 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]',
        success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
        warning: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
        destructive: 'border-destructive/35 bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
