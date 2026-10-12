import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'rounded-full border border-border/70 bg-background/30 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:border-primary/45 hover:bg-primary/[0.08]',
        primary:
          'rounded-full border border-white/25 bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_10px_28px_-8px_rgba(255,69,15,0.55)] hover:border-white/35 hover:bg-primary/90 hover:text-primary-foreground',
        ghost: 'rounded-full hover:bg-white/10 hover:text-foreground',
        outline:
          'rounded-full border border-border/70 bg-background/25 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:border-primary/40 hover:bg-primary/[0.08]',
        /** Actions rapides (topbar, etc.) : verre, jamais texte foncé sur fond brun. */
        quickSecondary:
          'rounded-full border border-border/70 bg-background/30 font-medium text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:border-primary/50 hover:bg-primary/[0.08]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
