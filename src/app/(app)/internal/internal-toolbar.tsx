'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Search } from 'lucide-react';
import type { Employee } from '@/types/database';
import type { InternalPriority, ProjectStatus } from '@/types/database';
import { Input } from '@/components/ui/input';
import { PROJECT_STATUS_MAP, INTERNAL_PRIORITY_MAP } from '@/types/domain';

const selectCls =
  'h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground';

export function InternalProjectsToolbar({
  employees,
  defaultQ,
  defaultStatus,
  defaultOwner,
  defaultPriority,
}: {
  employees: Pick<Employee, 'id' | 'full_name'>[];
  defaultQ?: string;
  defaultStatus: string;
  defaultOwner: string;
  defaultPriority: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function push(next: Record<string, string>) {
    const p = new URLSearchParams(sp?.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v || v === 'all') p.delete(k);
      else p.set(k, v);
    }
    start(() => router.push(`/internal?${p.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-4 backdrop-blur-sm lg:flex-row lg:flex-wrap lg:items-end">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={defaultQ}
          placeholder="Rechercher…"
          className="h-10 pl-9"
          onChange={(e) => push({ q: e.target.value })}
        />
      </div>
      <select
        className={selectCls}
        defaultValue={defaultStatus}
        disabled={pending}
        onChange={(e) => push({ status: e.target.value })}
      >
        <option value="all">Tous statuts</option>
        {(Object.keys(PROJECT_STATUS_MAP) as ProjectStatus[]).map((k) => (
          <option key={k} value={k}>
            {PROJECT_STATUS_MAP[k].label}
          </option>
        ))}
      </select>
      <select
        className={selectCls}
        defaultValue={defaultOwner}
        disabled={pending}
        onChange={(e) => push({ owner: e.target.value })}
      >
        <option value="all">Tous owners</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.full_name}
          </option>
        ))}
      </select>
      <select
        className={selectCls}
        defaultValue={defaultPriority}
        disabled={pending}
        onChange={(e) => push({ priority: e.target.value })}
      >
        <option value="all">Toutes priorités</option>
        {(Object.keys(INTERNAL_PRIORITY_MAP) as InternalPriority[]).map((k) => (
          <option key={k} value={k}>
            {INTERNAL_PRIORITY_MAP[k].label}
          </option>
        ))}
      </select>
    </div>
  );
}
