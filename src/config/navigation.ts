/**
 * Navigation principale — routes protégées (groupe `(app)`).
 * Icônes : noms export lucide-react (résolus côté client dans AppSidebar).
 */

export type NavIconName =
  | 'LayoutDashboard'
  | 'Users'
  | 'Clapperboard'
  | 'CalendarRange'
  | 'ListTodo'
  | 'CalendarDays'
  | 'FolderKanban'
  | 'Briefcase'
  | 'UsersRound'
  | 'FileText'
  | 'FileSpreadsheet'
  | 'Wallet'
  | 'BarChart3'
  | 'Files'
  | 'Globe'
  | 'Bell'
  | 'Settings';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const APP_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Vue d’ensemble',
    items: [{ href: '/dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard' }],
  },
  {
    label: 'Production',
    items: [
      { href: '/clients', label: 'Clients', icon: 'Users' },
      { href: '/videos', label: 'Vidéos', icon: 'Clapperboard' },
      { href: '/editorial', label: 'Calendrier éditorial', icon: 'CalendarRange' },
      { href: '/tasks', label: 'Tâches', icon: 'ListTodo' },
      { href: '/tasks/calendar', label: 'Calendrier tâches', icon: 'CalendarDays' },
      { href: '/projects', label: 'Projets', icon: 'FolderKanban' },
      { href: '/internal', label: 'Projets internes', icon: 'Briefcase' },
    ],
  },
  {
    label: 'Équipe & finance',
    items: [
      { href: '/team', label: 'Équipe', icon: 'UsersRound' },
      { href: '/invoices', label: 'Factures', icon: 'FileText' },
      { href: '/quotes', label: 'Devis', icon: 'FileSpreadsheet' },
      { href: '/payments', label: 'Paiements', icon: 'Wallet' },
      { href: '/reports', label: 'Rapports', icon: 'BarChart3' },
      { href: '/documents', label: 'Documents', icon: 'Files' },
    ],
  },
  {
    label: 'Portail & système',
    items: [
      { href: '/portal-admin', label: 'Portail clients', icon: 'Globe' },
      { href: '/notifications', label: 'Notifications', icon: 'Bell' },
      { href: '/settings', label: 'Paramètres', icon: 'Settings' },
    ],
  },
];
