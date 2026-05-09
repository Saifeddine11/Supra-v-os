'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClientFormDialog } from './client-form-dialog';
import type { Employee } from '@/types/database';
import type { ClientStatus } from '@/types/database';

const STATUS_OPTS: { value: ClientStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'active', label: 'Actif' },
  { value: 'pause', label: 'En pause' },
  { value: 'terminated', label: 'Terminé' },
];

export function ClientsToolbar({
  employees,
  canCreate,
  defaultQ,
  defaultStatus,
}: {
  employees: Pick<Employee, 'id' | 'full_name'>[];
  canCreate: boolean;
  defaultQ?: string;
  defaultStatus?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <form method="GET" action="/clients" className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <Input name="q" placeholder="Rechercher…" defaultValue={defaultQ} className="sm:max-w-xs" />
        <select
          name="status"
          defaultValue={defaultStatus ?? 'all'}
          className="h-10 rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:w-48"
        >
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" size="sm">
          Filtrer
        </Button>
      </form>
      {canCreate ? (
        <ClientFormDialog
          employees={employees}
          trigger={
            <Button variant="primary" className="rounded-full">
              <Plus className="h-4 w-4" />
              Nouveau client
            </Button>
          }
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Création réservée aux rôles admin, chef de projet ou commercial.
        </p>
      )}
    </div>
  );
}
