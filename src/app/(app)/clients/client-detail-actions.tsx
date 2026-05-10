'use client';

import { useRouter } from 'next/navigation';
import type { Client, Employee } from '@/types/database';
import { ClientRowActions } from './client-row-actions';

export function ClientDetailActions({
  client,
  employees,
  defaultAgencyCurrency,
  canEdit,
  canDelete,
}: {
  client: Client;
  employees: Pick<Employee, 'id' | 'full_name'>[];
  defaultAgencyCurrency: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  return (
    <ClientRowActions
      client={client}
      employees={employees}
      defaultAgencyCurrency={defaultAgencyCurrency}
      canEdit={canEdit}
      canDelete={canDelete}
      onDeleted={() => router.push('/clients')}
    />
  );
}
