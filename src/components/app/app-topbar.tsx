'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { titleForPathname } from '@/lib/page-titles';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/shared/user-avatar';
import { NotificationBell } from '@/components/app/notification-bell';
import { ThemeToggle } from '@/components/app/theme-toggle';
import type { Employee, Notification } from '@/types/database';
import { navItemVisible } from '@/lib/auth/nav-policy';
import { canModifyInvoices } from '@/lib/auth/capabilities';

export interface AppTopbarProps {
  employee: Employee;
  email: string;
  initialUnread: number;
  initialBellPreview: Notification[];
}

export function AppTopbar({ employee, email, initialUnread, initialBellPreview }: AppTopbarProps) {
  const pathname = usePathname();
  const title = titleForPathname(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-[hsl(var(--background)/0.88)] backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-sans text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {title}
          </h1>
        </div>

        <div className="relative hidden max-w-xs flex-1 md:block lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Rechercher clients, tâches, factures…"
            className="h-10 w-full rounded-full border border-border/80 bg-card py-2 pl-10 pr-4 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label="Recherche globale"
          />
        </div>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {navItemVisible('/clients', employee.role) ? (
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <Link href="/clients">
                <Plus className="h-4 w-4" />
                Client
              </Link>
            </Button>
          ) : null}
          {navItemVisible('/tasks', employee.role) ? (
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <Link href="/tasks">
                <Plus className="h-4 w-4" />
                Tâche
              </Link>
            </Button>
          ) : null}
          {canModifyInvoices(employee.role) ? (
            <Button variant="primary" size="sm" className="rounded-full" asChild>
              <Link href="/invoices">
                <Plus className="h-4 w-4" />
                Facture
              </Link>
            </Button>
          ) : null}
        </div>

        <ThemeToggle />
        <NotificationBell initialUnread={initialUnread} initialPreview={initialBellPreview} />

        <div className="hidden h-8 w-px shrink-0 bg-border sm:block" />

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="max-w-[140px] truncate text-xs font-medium text-foreground">{employee.full_name}</p>
            <p className="text-[10px] capitalize text-muted-foreground">
              {employee.role?.replace(/_/g, ' ') ?? '—'}
            </p>
          </div>
          <UserAvatar
            name={employee.full_name}
            initials={employee.avatar_initials}
            color={employee.avatar_color}
            size="sm"
            className="ring-1 ring-border"
          />
        </div>
      </div>
      <p className="sr-only">{email}</p>
    </header>
  );
}
