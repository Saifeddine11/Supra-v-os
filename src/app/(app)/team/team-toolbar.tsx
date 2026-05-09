'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Search } from 'lucide-react';
import type { UserRole } from '@/types/database';
import { Input } from '@/components/ui/input';
import { OPERATIONAL_SKILL_ROLES, ROLE_LABELS, TEAM_ASSIGNABLE_ROLES } from '@/types/domain';

const selectCls =
  'h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground';

const AVAIL_OPTS = [
  { value: 'all', label: 'Charge : tous' },
  { value: 'available', label: 'Disponible' },
  { value: 'busy', label: 'Occupé' },
  { value: 'overloaded', label: 'Surchargé' },
  { value: 'inactive', label: 'Compte inactif' },
] as const;

const ACCOUNT_OPTS = [
  { value: 'all', label: 'Compte : tous' },
  { value: 'active', label: 'Compte actif' },
  { value: 'inactive', label: 'Compte inactif' },
] as const;

const ARCHIVE_OPTS = [
  { value: 'exclude', label: 'Sans archivés' },
  { value: 'include', label: 'Tous (+ archivés)' },
  { value: 'only', label: 'Archivés seulement' },
] as const;

function isDefaultParam(key: string, value: string): boolean {
  if (!value || value === 'all') return true;
  if (key === 'archived' && value === 'exclude') return true;
  if (key === 'account' && value === 'all') return true;
  if (key === 'overdue' && value !== '1') return true;
  if (key === 'skill' && (value === 'all' || !value)) return true;
  return false;
}

export function TeamToolbar({
  defaultQ,
  defaultRole,
  defaultAvailability,
  defaultAccount,
  defaultArchived,
  defaultOverdue,
  defaultSkill,
}: {
  defaultQ?: string;
  defaultRole: string;
  defaultAvailability: string;
  defaultAccount?: string;
  defaultArchived?: string;
  defaultOverdue?: string;
  defaultSkill?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function applyParam(key: string, value: string) {
    const p = new URLSearchParams(sp?.toString());
    if (isDefaultParam(key, value)) p.delete(key);
    else p.set(key, value);
    start(() => router.push(`/team?${p.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-4 backdrop-blur-sm lg:flex-row lg:flex-wrap lg:items-end">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={defaultQ}
          placeholder="Nom, e-mail, téléphone…"
          className="h-10 pl-9"
          onChange={(e) => applyParam('q', e.target.value.trim())}
        />
      </div>
      <select
        className={selectCls}
        defaultValue={defaultRole}
        disabled={pending}
        onChange={(e) => applyParam('role', e.target.value)}
      >
        <option value="all">Rôle principal : tous</option>
        {TEAM_ASSIGNABLE_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r as UserRole]}
          </option>
        ))}
      </select>
      <select
        className={selectCls}
        defaultValue={defaultSkill ?? 'all'}
        disabled={pending}
        onChange={(e) => applyParam('skill', e.target.value)}
      >
        <option value="all">Compétence : toutes</option>
        {OPERATIONAL_SKILL_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r as UserRole]}
          </option>
        ))}
      </select>
      <select
        className={selectCls}
        defaultValue={defaultAvailability}
        disabled={pending}
        onChange={(e) => applyParam('availability', e.target.value)}
      >
        {AVAIL_OPTS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={selectCls}
        defaultValue={defaultAccount ?? 'all'}
        disabled={pending}
        onChange={(e) => applyParam('account', e.target.value)}
      >
        {ACCOUNT_OPTS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={selectCls}
        defaultValue={defaultArchived ?? 'exclude'}
        disabled={pending}
        onChange={(e) => applyParam('archived', e.target.value)}
      >
        {ARCHIVE_OPTS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="rounded border-input"
          defaultChecked={defaultOverdue === '1'}
          onChange={(e) => applyParam('overdue', e.target.checked ? '1' : '')}
        />
        Tâches en retard
      </label>
    </div>
  );
}
