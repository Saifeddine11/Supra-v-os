/** Titres topbar par chemin (prefix match). */

const ENTRIES: { prefix: string; title: string }[] = [
  { prefix: '/dashboard', title: 'Tableau de bord' },
  { prefix: '/clients', title: 'Clients' },
  { prefix: '/videos', title: 'Production vidéo' },
  { prefix: '/editorial', title: 'Calendrier éditorial' },
  { prefix: '/tasks/calendar', title: 'Calendrier des tâches' },
  { prefix: '/tasks', title: 'Tâches' },
  { prefix: '/projects', title: 'Projets' },
  { prefix: '/internal', title: 'Projets internes' },
  { prefix: '/team', title: 'Équipe' },
  { prefix: '/invoices', title: 'Factures' },
  { prefix: '/quotes', title: 'Devis' },
  { prefix: '/payments', title: 'Paiements' },
  { prefix: '/reports', title: 'Rapports' },
  { prefix: '/documents', title: 'Documents' },
  { prefix: '/portal-admin', title: 'Portail clients' },
  { prefix: '/notifications', title: 'Notifications' },
  { prefix: '/settings', title: 'Paramètres' },
];

export function titleForPathname(pathname: string): string {
  const hit = ENTRIES.find((e) => pathname === e.prefix || pathname.startsWith(e.prefix + '/'));
  return hit?.title ?? 'Supra v. Agency OS';
}
