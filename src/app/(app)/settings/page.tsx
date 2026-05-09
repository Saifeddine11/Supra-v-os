import type { Metadata } from 'next';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { SectionCard } from '@/components/shared/section-card';
import { AgencySettingsDbForm } from '@/components/settings/agency-settings-db-form';
import { NotificationPreferencesForm } from '@/components/settings/notification-preferences-form';
import { ROLE_LABELS } from '@/types/domain';
import { getAuthContext } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/app/(app)/actions';
import { getAgencySettingsRow } from '@/lib/data/agency-settings-db';
import { getMyNotificationPreferences } from '@/lib/data/notification-preferences';

export const metadata: Metadata = { title: 'Paramètres' };

export default async function SettingsPage() {
  const ctx = await getAuthContext();
  const roleLabel = ctx?.role ? ROLE_LABELS[ctx.role] : '—';
  const canEditAgency = ctx?.role === 'admin';

  const [agencyRow, notifPrefs] = await Promise.all([
    getAgencySettingsRow(),
    ctx?.userId ? getMyNotificationPreferences(ctx.userId) : Promise.resolve(null),
  ]);

  const integrations = {
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseService: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    resend: Boolean(process.env.RESEND_API_KEY),
    cron: Boolean(process.env.CRON_SECRET),
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
  };

  const cronLabels = [
    {
      path: '/api/cron/daily',
      label: 'Job quotidien Vercel Hobby (lun–ven 7h30 UTC) : factures → échéances → rappels matin',
    },
    { path: '/api/cron/morning-reminders', label: 'Unitaire (tests / Pro)' },
    { path: '/api/cron/overdue-invoices', label: 'Unitaire (tests / Pro)' },
    { path: '/api/cron/deadline-alerts', label: 'Unitaire — fréquent recommandé sur Pro' },
    { path: '/api/cron/evening-summary', label: 'Unitaire — 2ᵉ cron typique sur Pro' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Apparence, profil agence (Supabase), facturation, notifications et intégrations.
        </p>
      </div>

      <SectionCard
        title="Apparence"
        description="Mode sombre Supra (par défaut), mode clair premium, ou préférence système."
        action={<ThemeToggle />}
      >
        <p className="text-sm text-muted-foreground">
          Le choix de thème est enregistré localement et restauré automatiquement au rechargement.
        </p>
      </SectionCard>

      <SectionCard
        title="Profil agence & portail"
        description="Données partagées par l’équipe — stockées dans agency_settings (migration P1)."
      >
        <AgencySettingsDbForm
          row={agencyRow}
          canEdit={canEditAgency}
          key={agencyRow ? `agency-${agencyRow.updated_at}` : 'agency-missing'}
        />
      </SectionCard>

      <SectionCard
        title="Facturation & devis (valeurs par défaut)"
        description="Les préfixes complètent les séquences SQL (FAC-YYYY-###, etc.)."
      >
        <p className="text-sm text-muted-foreground">
          Modifiables dans la section ci-dessus (admin) : préfixes, devise, TVA %, conditions de paiement type.
        </p>
      </SectionCard>

      <SectionCard
        title="Notifications"
        description="Emails cron (Resend) et alertes in-app — par utilisateur."
      >
        {ctx?.userId ? (
          <NotificationPreferencesForm
            prefs={notifPrefs}
            key={notifPrefs ? `notif-${notifPrefs.updated_at}` : `notif-new-${ctx.userId}`}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Connectez-vous pour gérer vos préférences.</p>
        )}
      </SectionCard>

      <SectionCard title="Sécurité & session" description="Compte connecté">
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Utilisateur</dt>
            <dd className="text-foreground">{ctx?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Rôle</dt>
            <dd className="text-foreground">{roleLabel}</dd>
          </div>
          {ctx?.userId ? (
            <div>
              <dt className="text-xs text-muted-foreground">Identifiant session (extrait)</dt>
              <dd className="font-mono text-xs text-muted-foreground">
                {ctx.userId.slice(0, 8)}…{ctx.userId.slice(-4)}
              </dd>
            </div>
          ) : null}
        </dl>
        <form action={signOutAction} className="mt-4">
          <Button type="submit" variant="outline" className="rounded-full">
            Se déconnecter
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Intégrations" description="État de configuration (variables d’environnement)">
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between gap-2 border-b border-border/60 py-2">
            <span className="text-muted-foreground">Supabase (URL + clé anon)</span>
            <span className={integrations.supabase ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
              {integrations.supabase ? 'Configuré' : 'Manquant'}
            </span>
          </li>
          <li className="flex justify-between gap-2 border-b border-border/60 py-2">
            <span className="text-muted-foreground">Supabase service role (Storage, portail, cron)</span>
            <span
              className={
                integrations.supabaseService ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
              }
            >
              {integrations.supabaseService ? 'Configuré' : 'Manquant'}
            </span>
          </li>
          <li className="flex justify-between gap-2 border-b border-border/60 py-2">
            <span className="text-muted-foreground">Resend (emails)</span>
            <span className={integrations.resend ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
              {integrations.resend ? 'Configuré' : 'Optionnel / absent'}
            </span>
          </li>
          <li className="flex justify-between gap-2 border-b border-border/60 py-2">
            <span className="text-muted-foreground">Cron (secret)</span>
            <span className={integrations.cron ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
              {integrations.cron ? 'Configuré' : 'Non défini'}
            </span>
          </li>
          <li className="flex justify-between gap-2 py-2">
            <span className="text-muted-foreground">URL app (NEXT_PUBLIC_APP_URL)</span>
            <span className="max-w-[55%] truncate text-xs text-foreground">{integrations.appUrl || '—'}</span>
          </li>
        </ul>
        <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Crons Vercel (aperçu)</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {cronLabels.map((c) => (
              <li key={c.path}>
                {c.label} — <code className="text-[10px]">{c.path}</code>
              </li>
            ))}
          </ul>
          <p className="mt-2">
            En production Hobby, seul <code className="text-[10px]">/api/cron/daily</code> est planifié dans{' '}
            <code className="text-[10px]">vercel.json</code>. Les autres routes restent pour tests manuels ou Vercel
            Pro.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
