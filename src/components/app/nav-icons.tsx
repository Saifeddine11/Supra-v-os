'use client';

import type { NavIconName } from '@/config/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Clapperboard,
  CalendarRange,
  ListTodo,
  CalendarDays,
  FolderKanban,
  Briefcase,
  UsersRound,
  FileText,
  FileSpreadsheet,
  Wallet,
  BarChart3,
  Files,
  Globe,
  Bell,
  Settings,
} from 'lucide-react';

const MAP: Record<NavIconName, LucideIcon> = {
  LayoutDashboard,
  Users,
  Clapperboard,
  CalendarRange,
  ListTodo,
  CalendarDays,
  FolderKanban,
  Briefcase,
  UsersRound,
  FileText,
  FileSpreadsheet,
  Wallet,
  BarChart3,
  Files,
  Globe,
  Bell,
  Settings,
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = MAP[name];
  return <Icon className={className} aria-hidden />;
}
