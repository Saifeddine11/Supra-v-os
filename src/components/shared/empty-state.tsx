import { cn } from '@/lib/utils/cn';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/80 px-6 py-14 text-center',
        className
      )}
    >
      {icon ? <div className="mb-4 text-primary/80">{icon}</div> : null}
      <h3 className="font-sans text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
