'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  Clapperboard,
  FileBarChart,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { AGENCY } from '@/lib/constants';
import { UserAvatar } from '@/components/shared/user-avatar';
import { ClientColorDot } from '@/components/shared/client-color-dot';
import { getClientAccent } from '@/lib/ui/client-colors';
import { signOutClientAction } from '@/app/client/(authenticated)/actions';

const NAV = [
  { href: '/client', label: 'Vue d’ensemble', icon: LayoutDashboard, exact: true },
  { href: '/client/projects', label: 'Projets', icon: FolderKanban, exact: false },
  { href: '/client/videos', label: 'Vidéos', icon: Clapperboard, exact: false },
  { href: '/client/planning', label: 'Planning', icon: CalendarDays, exact: false },
  { href: '/client/invoices', label: 'Factures', icon: Receipt, exact: false },
  { href: '/client/reports', label: 'Rapports', icon: FileBarChart, exact: false, reports: true },
] as const;

function navActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function pageTitleFromPath(pathname: string): string {
  if (pathname.startsWith('/client/projects/')) return 'Projet';
  if (pathname.startsWith('/client/projects')) return 'Projets';
  if (pathname.startsWith('/client/videos')) return 'Vidéos';
  if (pathname.startsWith('/client/planning')) return 'Planning';
  if (pathname.startsWith('/client/invoices')) return 'Factures';
  if (pathname.startsWith('/client/reports')) return 'Rapports';
  return 'Vue d’ensemble';
}

export function ClientWorkspaceShell({
  clientName,
  userName,
  email,
  logoUrl,
  colorHex,
  showReports,
  children,
}: {
  clientName: string;
  userName: string;
  email: string;
  logoUrl: string | null;
  colorHex: string | null;
  showReports: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const accent = getClientAccent({ name: clientName, color_hex: colorHex });
  const items = NAV.filter((n) => !('reports' in n && n.reports) || showReports);
  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 py-4">
      {items.map((item) => {
        const active = navActive(pathname, item.href, item.exact);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              active
                ? 'bg-primary/[0.12] text-primary ring-1 ring-primary/25'
                : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
            )}
          >
            <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-primary')} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="relative z-10 min-h-screen">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        id="client-workspace-nav"
        aria-label="Navigation espace client"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-white/[0.06] bg-[#0c0b0a]/95 backdrop-blur-xl transition-transform lg:w-[232px] lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 py-3.5">
          <div className="min-w-0">
            <p className="font-serif text-lg tracking-tight text-supra-gradient">{AGENCY.name}</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Espace client
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {nav}
        <div className="mt-auto border-t border-white/[0.06] p-2.5">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5">
            <UserAvatar name={userName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{userName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{clientName}</p>
            </div>
          </div>
          <form action={signOutClientAction} className="mt-2">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/[0.06] bg-[#0c0b0a]/80 px-4 py-3.5 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Ouvrir le menu"
              aria-expanded={open}
              aria-controls="client-workspace-nav"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {todayLabel}
              </p>
              <h1 className="truncate font-sans text-lg font-semibold tracking-tight text-foreground">
                {pageTitleFromPath(pathname)}
              </h1>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="flex max-w-[220px] items-center justify-end gap-1.5 truncate text-sm font-medium text-foreground">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="h-6 w-6 rounded-md object-cover ring-1 ring-white/10" />
                ) : (
                  <ClientColorDot hex={accent.color} />
                )}
                {clientName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{email}</p>
            </div>
            <UserAvatar name={userName} size="sm" />
          </div>
        </header>
        <main className="cockpit-enter px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
