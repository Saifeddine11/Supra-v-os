import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        primary: 'border-primary/30 bg-primary/[0.08] text-primary',
        outline: 'border-border/80 text-muted-foreground',
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
