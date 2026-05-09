'use client';

import type { UserRole } from '@/types/database';
import { ROLE_LABELS, OPERATIONAL_SKILL_ROLES } from '@/types/domain';

export function OperationalSkillsFields({ defaultSelected }: { defaultSelected: UserRole[] }) {
  const sel = new Set(defaultSelected);
  return (
    <div className="grid gap-2">
      <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2">
        {OPERATIONAL_SKILL_ROLES.map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="operational_skills"
              value={r}
              defaultChecked={sel.has(r)}
              className="rounded border-input"
            />
            <span>{ROLE_LABELS[r]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
