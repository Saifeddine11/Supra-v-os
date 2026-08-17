'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { getNavGroupsForRole } from '@/lib/auth/nav-policy';
import { NavIcon } from '@/components/app/nav-icons';
import { signOutAction } from '@/app/(app)/actions';
import { UserAvatar } from '@/components/shared/user-avatar';
import type { Employee } from '@/types/database';

export interface AppSidebarProps {
  employee: Employee;
  email: string;
}

function isNavActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === '/tasks') {
    if (!pathname.startsWith('/tasks')) return false;
    return !pathname.startsWith('/tasks/calendar');
  }
  return pathname.startsWith(`${href}/`);
}

export function AppSidebar({ employee, email }: AppSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navGroups = getNavGroupsForRole(employee.role);

  const linkClass = (href: string) => {
    const active = isNavActive(pathname, href);
    return cn(
      'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
      active
        ? 'bg-primary/[0.12] text-primary ring-1 ring-primary/25'
        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
    );
  };

  const NavBlock = (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2.5 py-3">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={linkClass(item.href)}
                  onClick={() => setOpen(false)}
                >
                  <NavIcon
                    name={item.icon}
                    className={cn(
                      'h-[18px] w-[18px] shrink-0 transition-colors',
                      isNavActive(pathname, item.href)
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground shadow-lg lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden"
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {/* Sidebar drawer mobile / fixed desktop */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-border/80 bg-surface-secondary/95 backdrop-blur-xl transition-transform lg:w-[224px] lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3.5 py-3.5">
          <Link href="/dashboard" className="block min-w-0" onClick={() => setOpen(false)}>
            <p className="font-serif text-lg tracking-tight text-supra-gradient">Supra v.</p>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Agency OS
            </p>
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent/60 hover:text-foreground lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {NavBlock}

        <div className="mt-auto border-t border-border/70 p-2.5">
          <div className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-card p-2.5">
            <UserAvatar
              name={employee.full_name}
              initials={employee.avatar_initials}
              color={employee.avatar_color}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{employee.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <form action={signOutAction} className="mt-2">
            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-lg border border-border bg-secondary py-2 text-xs font-semibold text-secondary-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.08]"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
