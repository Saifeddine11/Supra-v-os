'use client';

import { useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Search } from 'lucide-react';
import type { Client } from '@/types/database';
import type { ProjectStatus, TaskPriority } from '@/types/database';
import { Input } from '@/components/ui/input';
import { PROJECT_STATUS_MAP, PRIORITY_MAP, PROJECT_TYPE_OPTIONS } from '@/types/domain';

const selectCls =
  'h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground';

export function ProjectsToolbar({
  clients,
  defaultQ,
  defaultStatus,
  defaultType,
  defaultClient,
  defaultPriority,
}: {
  clients: Pick<Client, 'id' | 'name'>[];
  defaultQ?: string;
  defaultStatus: string;
  defaultType: string;
  defaultClient: string;
  defaultPriority: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function push(next: Record<string, string>) {
    const p = new URLSearchParams(sp?.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v || v === 'all') p.delete(k);
      else p.set(k, v);
    }
    start(() => router.push(`/projects?${p.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-4 backdrop-blur-sm lg:flex-row lg:flex-wrap lg:items-end">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={defaultQ}
          placeholder="Rechercher projet, client…"
          className="h-10 pl-9"
          onChange={(e) => {
            if (searchTimer.current) clearTimeout(searchTimer.current);
            const v = e.target.value;
            searchTimer.current = setTimeout(() => push({ q: v }), 320);
          }}
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
        defaultValue={defaultType}
        disabled={pending}
        onChange={(e) => push({ type: e.target.value })}
      >
        <option value="all">Tous types</option>
        {PROJECT_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={selectCls}
        defaultValue={defaultClient}
        disabled={pending}
        onChange={(e) => push({ client: e.target.value })}
      >
        <option value="all">Tous clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
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
        {(Object.keys(PRIORITY_MAP) as TaskPriority[]).map((k) => (
          <option key={k} value={k}>
            {PRIORITY_MAP[k].label}
          </option>
        ))}
      </select>
    </div>
  );
}
