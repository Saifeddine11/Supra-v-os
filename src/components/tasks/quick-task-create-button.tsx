'use client';

import { Plus } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { TaskFormDialog } from '@/app/(app)/tasks/task-form-dialog';
import type { Client, Employee } from '@/types/database';
import { cn } from '@/lib/utils/cn';

/** Bouton « Nouvelle tâche » / « + Tâche » — ouvre le formulaire de création (board, topbar, calendrier). */
export function QuickTaskCreateButton({
  clients,
  employees,
  label = 'Nouvelle tâche',
  className,
  variant = 'primary',
  size = 'sm',
  showIcon = true,
}: {
  clients: Pick<Client, 'id' | 'name' | 'color_hex' | 'color_label'>[];
  employees: Pick<Employee, 'id' | 'full_name'>[];
  label?: string;
  className?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  showIcon?: boolean;
}) {
  return (
    <TaskFormDialog
      clients={clients}
      employees={employees}
      trigger={
        <Button type="button" variant={variant} size={size} className={cn('rounded-full', className)}>
          {showIcon ? <Plus className="h-4 w-4" /> : null}
          {label}
        </Button>
      }
    />
  );
}
