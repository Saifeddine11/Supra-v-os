import Link from 'next/link';
import type { UserRole } from '@/types/database';

/**
 * Rappels métier (liens vers les modules) — pas de données techniques.
 */
export function SettingsRoleHints({ role }: { role: UserRole }) {
  const linkCls = 'font-medium text-primary hover:underline';

  switch (role) {
    case 'admin':
      return (
        <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
          <li>
            <Link href="/team" className={linkCls}>
              Équipe
            </Link>{' '}
            — rôles, accès, invitations.
          </li>
          <li>
            <Link href="/portal-admin" className={linkCls}>
              Portail client (admin)
            </Link>
          </li>
          <li>
            <Link href="/internal" className={linkCls}>
              Projets internes
            </Link>
          </li>
        </ul>
      );
    case 'project_manager':
      return (
        <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
          <li>
            <Link href="/tasks/calendar" className={linkCls}>
              Calendrier des tâches
            </Link>{' '}
            — planning et échéances.
          </li>
          <li>
            <Link href="/tasks" className={linkCls}>
              Tâches
            </Link>{' '}
            — suivi opérationnel.
          </li>
          <li>
            <Link href="/team" className={linkCls}>
              Équipe
            </Link>{' '}
            — rosters et charge.
          </li>
        </ul>
      );
    case 'commercial':
      return (
        <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
          <li>
            <Link href="/clients" className={linkCls}>
              Clients
            </Link>{' '}
            — dossiers et contacts.
          </li>
          <li>
            <Link href="/quotes" className={linkCls}>
              Devis
            </Link>{' '}
            — propositions commerciales.
          </li>
        </ul>
      );
    case 'finance':
      return (
        <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
          <li>
            <Link href="/invoices" className={linkCls}>
              Factures
            </Link>
          </li>
          <li>
            <Link href="/payments" className={linkCls}>
              Paiements
            </Link>
          </li>
        </ul>
      );
    case 'editor':
    case 'cameraman':
      return (
        <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
          <li>
            <Link href="/tasks" className={linkCls}>
              Tâches
            </Link>{' '}
            — assignations et deadlines.
          </li>
          <li>
            <Link href="/videos" className={linkCls}>
              Vidéos
            </Link>{' '}
            — production et statuts.
          </li>
        </ul>
      );
    case 'community_manager':
      return (
        <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
          <li>
            <Link href="/editorial" className={linkCls}>
              Calendrier éditorial
            </Link>
          </li>
          <li>
            <Link href="/tasks" className={linkCls}>
              Tâches
            </Link>
          </li>
        </ul>
      );
    case 'developer':
    case 'designer':
    case 'seo':
      return (
        <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
          <li>
            <Link href="/tasks" className={linkCls}>
              Tâches
            </Link>
          </li>
          <li>
            <Link href="/projects" className={linkCls}>
              Projets clients
            </Link>
          </li>
        </ul>
      );
    default:
      return (
        <p className="text-sm text-muted-foreground">
          Accédez à vos modules depuis le menu latéral.
        </p>
      );
  }
}
