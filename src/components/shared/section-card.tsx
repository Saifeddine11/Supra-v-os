import { cn } from '@/lib/utils/cn';

export interface SectionCardProps {
  id?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({ id, title, description, action, children, className }: SectionCardProps) {
  return (
    <section
      id={id}
      className={cn(
        'rounded-2xl border border-border/80 bg-card/92 shadow-[0_10px_28px_-18px_rgba(8,7,6,0.22)] backdrop-blur-sm dark:shadow-supra-glow',
        className
      )}
    >
      <header className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-sans text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
      </header>
      <div className="min-w-0 p-5">{children}</div>
    </section>
  );
}
