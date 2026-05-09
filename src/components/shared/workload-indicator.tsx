import { ProgressBar } from '@/components/shared/progress-bar';
import { cn } from '@/lib/utils/cn';
import type { WorkloadMember } from '@/data/dashboard-mock';

export function WorkloadIndicator({ member, className }: { member: WorkloadMember; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <div>
          <p className="font-medium text-foreground">{member.name}</p>
          <p className="text-xs text-muted-foreground">{member.role}</p>
        </div>
        <span
          className={cn(
            'tabular-nums text-xs font-semibold',
            member.percent >= 80 ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {member.percent}%
        </span>
      </div>
      <ProgressBar value={member.percent} />
    </div>
  );
}
