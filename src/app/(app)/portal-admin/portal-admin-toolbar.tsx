'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const selectCls =
  'h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground';

export function PortalAdminToolbar({ defaultQ, defaultState }: { defaultQ?: string; defaultState: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function push(next: Record<string, string>) {
    const p = new URLSearchParams(sp?.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v || v === 'all') p.delete(k);
      else p.set(k, v);
    }
    start(() => router.push(`/portal-admin?${p.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-4 backdrop-blur-sm lg:flex-row lg:items-end">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={defaultQ}
          placeholder="Rechercher client ou email…"
          className="h-10 pl-9"
          onChange={(e) => push({ q: e.target.value })}
        />
      </div>
      <select
        className={selectCls}
        defaultValue={defaultState}
        disabled={pending}
        onChange={(e) => push({ state: e.target.value })}
      >
        <option value="all">Tous</option>
        <option value="active">Portail actif</option>
        <option value="inactive">Jeton mais inactif</option>
        <option value="missing_token">Sans jeton</option>
      </select>
    </div>
  );
}
