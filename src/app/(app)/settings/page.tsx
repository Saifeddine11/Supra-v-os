import type { Metadata } from 'next';
import Link from 'next/link';
import { addMonths, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { SectionCard } from '@/components/shared/section-card';
import { AgencySettingsDbForm } from '@/components/settings/agency-settings-db-form';
import { MonthlyGoalsSection } from '@/components/settings/monthly-goals-section';
import { NotificationPreferencesForm } from '@/components/settings/notification-preferences-form';
import { PersonalAccountSettingsSection } from '@/components/settings/personal-account-settings-section';
import { SettingsAdminTechnicalSection } from '@/components/settings/settings-admin-technical-section';
import { SettingsRoleHints } from '@/components/settings/settings-role-hints';
import { ROLE_LABELS } from '@/types/domain';
import { requireAuth } from '@/lib/auth/permissions';
import {
  canManageAgencySettingsInUi,
  canViewSettingsTechnicalSection,
} from '@/lib/auth/capabilities';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/app/(app)/actions';
import { getAgencySettingsRow } from '@/lib/data/agency-settings-db';
import {
  currentDashboardYearMonth,
  getAgencyMonthlyGoalForMonth,
} from '@/lib/data/agency-monthly-goals';
import { getMyNotificationPreferences } from '@/lib/data/notification-preferences';

export const metadata: Metadata = { title: 'Paramètres' };

function parseYm(raw: string | undefined): { year: number; month: number } | null {
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return null;
  const [y, m] = raw.split('-').map(Number);
  if (y < 2020 || y > 2100 || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ ym?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireAuth();
  const role = ctx.role;
  const roleLabel = role ? ROLE_LABELS[role] : '—';

  const showAgencyAndPortal = canManageAgencySettingsInUi(role);
  const showTechnical = canViewSettingsTechnicalSection(role);

  const ymParam = typeof sp?.ym === 'string' ? sp.ym : undefined;
  const ymSel = parseYm(ymParam) ?? currentDashboardYearMonth();
  const goalAnchor = new Date(ymSel.year, ymSel.month - 1, 1);
  const prevD = addMonths(goalAnchor, -1);
  const nextD = addMonths(goalAnchor, 1);
  const prevYm = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`;
  const nextYm = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = format(goalAnchor, 'MMMM yyyy', { locale: fr });

  const [agencyRow, notifPrefs, monthlyGoalRow] = await Promise.all([
    showAgencyAndPortal ? getAgencySettingsRow() : Promise.resolve(null),
    ctx.userId ? getMyNotificationPreferences(ctx.userId) : Promise.resolve(null),
    showAgencyAndPortal ? getAgencyMonthlyGoalForMonth(ymSel.year, ymSel.month) : Promise.resolve(null),
  ]);

  const employee = ctx.employee;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {showTechnical
            ? 'Agence, intégrations, notifications, apparence et sécurité.'
            : 'Votre compte, apparence, notifications et sécurité.'}
        </p>
      </div>

      {employee ? (
        <SectionCard
          title="Mon compte"
          description="Informations de votre fiche employé (visibles par l’équipe selon les règles d’accès)."
        >
          <PersonalAccountSettingsSection employee={employee} email={ctx.email} role={employee.role} />
        </SectionCard>
      ) : (
        <SectionCard title="Mon compte" description="Profil incomplet">
          <p className="text-sm text-muted-foreground">
            Aucune fiche employé liée à ce compte. Contactez un administrateur.
          </p>
          <dl className="mt-3 grid gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">E-mail</dt>
              <dd className="text-foreground">{ctx.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rôle applicatif</dt>
              <dd className="text-foreground">{roleLabel}</dd>
            </div>
          </dl>
        </SectionCard>
      )}

      <SectionCard
        title="Apparence"
        description="Mode sombre Supra (par défaut), mode clair premium, ou préférence système."
        action={<ThemeToggle />}
      >
        <p className="text-sm text-muted-foreground">
          Le choix de thème est enregistré localement et restauré automatiquement au rechargement.
        </p>
      </SectionCard>

      {role ? (
        <SectionCard
          title="Raccourcis métier"
          description="Accès rapide aux modules utiles pour votre rôle — sans configuration technique."
        >
          <SettingsRoleHints role={role} />
        </SectionCard>
      ) : null}

      <SectionCard
        title="Notifications"
        description="Rappels matin, alertes d’échéance, résumé du soir et e-mails (selon les crons configurés par l’administrateur)."
      >
        {ctx.userId ? (
          <NotificationPreferencesForm
            prefs={notifPrefs}
            key={notifPrefs ? `notif-${notifPrefs.updated_at}` : `notif-new-${ctx.userId}`}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Connectez-vous pour gérer vos préférences.</p>
        )}
      </SectionCard>

      <SectionCard title="Sécurité" description="Mot de passe, session et déconnexion">
        <div className="space-y-4 text-sm">
          <div>
            <Link href="/change-password">
              <Button type="button" variant="outline" className="rounded-full">
                Changer mon mot de passe
              </Button>
            </Link>
            <p className="mt-2 text-xs text-muted-foreground">
              Vous serez invité à vous reconnecter si votre administrateur impose un nouveau mot de passe.
            </p>
          </div>
          {ctx.userId ? (
            <dl className="border-t border-border/60 pt-4">
              <dt className="text-xs text-muted-foreground">Identifiant session (extrait)</dt>
              <dd className="mt-1 font-mono text-xs text-muted-foreground">
                {ctx.userId.slice(0, 8)}…{ctx.userId.slice(-4)}
              </dd>
            </dl>
          ) : null}
          <form action={signOutAction}>
            <Button type="submit" variant="outline" className="rounded-full">
              Se déconnecter
            </Button>
          </form>
        </div>
      </SectionCard>

      {showAgencyAndPortal ? (
        <>
          <SectionCard
            title="Profil agence & portail"
            description="Données partagées par l’équipe — visibles en lecture selon les politiques d’accès ; modification réservée aux administrateurs."
          >
            <AgencySettingsDbForm
              row={agencyRow}
              canEdit
              key={agencyRow ? `agency-${agencyRow.updated_at}` : 'agency-missing'}
            />
          </SectionCard>

          <MonthlyGoalsSection
            year={ymSel.year}
            month={ymSel.month}
            monthLabel={monthLabel}
            prevHref={`/settings?ym=${prevYm}#objectifs-mensuels`}
            nextHref={`/settings?ym=${nextYm}#objectifs-mensuels`}
            initialGoal={monthlyGoalRow}
            key={`goal-${ymSel.year}-${ymSel.month}-${monthlyGoalRow?.updated_at ?? 'new'}`}
          />

          <SectionCard
            title="Facturation & devis (valeurs par défaut)"
            description="Préfixes, devise, TVA % et conditions de paiement type — modifiables dans le formulaire agence ci-dessus."
          >
            <p className="text-sm text-muted-foreground">
              Les numéros de facture et de devis suivent les séquences définies en base (FAC-YYYY-###, etc.).
            </p>
          </SectionCard>

          <SectionCard
            title="Équipe & accès"
            description="Gestion des collaborateurs, rôles et liaison Supabase Auth."
          >
            <p className="text-sm text-muted-foreground">
              Gérez les fiches, les rôles et les invitations depuis le module Équipe.
            </p>
            <Button asChild variant="outline" className="mt-3 rounded-full">
              <Link href="/team">Ouvrir l’équipe</Link>
            </Button>
          </SectionCard>
        </>
      ) : null}

      {showTechnical ? (
        <SectionCard title="Intégrations & infrastructure" description="Réservé administrateur — ne pas partager.">
          <SettingsAdminTechnicalSection />
        </SectionCard>
      ) : null}
    </div>
  );
}
