import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

const variants: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
  default: 'outline',
  success: 'success',
  warning: 'warning',
  destructive: 'destructive',
};

export function StatusBadge({
  children,
  status = 'default',
  className,
}: {
  children: React.ReactNode;
  status?: keyof typeof variants;
  className?: string;
}) {
  return (
    <Badge variant={variants[status] ?? 'outline'} className={cn('capitalize', className)}>
      {children}
    </Badge>
  );
}
