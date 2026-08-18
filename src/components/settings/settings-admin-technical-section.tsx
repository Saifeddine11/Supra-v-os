import { CriticalSoundTestAdminButton } from '@/components/settings/critical-sound-test-admin-button';

/**
 * Intégrations et crons — réservé admin (données issues des variables d’environnement serveur).
 */
export function SettingsAdminTechnicalSection() {
  const integrations = {
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseService: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    resend: Boolean(process.env.RESEND_API_KEY),
    cron: Boolean(process.env.CRON_SECRET),
    discordToken: Boolean(process.env.DISCORD_BOT_TOKEN),
    discordGuild: Boolean((process.env.DISCORD_GUILD_ID ?? '').trim()),
    discordSync:
      ['1', 'true', 'yes'].includes((process.env.DISCORD_TASK_SYNC_ENABLED ?? '').trim().toLowerCase()),
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
    { path: '/api/cron/critical-alerts', label: 'Rappels digest alertes critiques (2 h) — CRON_SECRET' },
  ];

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Intégrations</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          État de configuration (variables d’environnement) — usage administrateur.
        </p>
      </div>
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
          <span className="text-muted-foreground">Resend (notifications app)</span>
          <span className={integrations.resend ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
            {integrations.resend ? 'Configuré' : 'Optionnel / absent'}
          </span>
        </li>
        <li className="flex flex-col gap-1 border-b border-border/60 py-2 sm:flex-row sm:justify-between">
          <span className="text-muted-foreground">Supabase Auth SMTP (invitations / reset)</span>
          <span className="text-xs text-muted-foreground sm:max-w-[55%] sm:text-right">
            À configurer dans le dashboard Supabase (Resend SMTP). Voir docs/SUPABASE_AUTH_SMTP.md — distinct de Resend
            ci-dessus.
          </span>
        </li>
        <li className="flex justify-between gap-2 border-b border-border/60 py-2">
          <span className="text-muted-foreground">Cron (secret)</span>
          <span className={integrations.cron ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
            {integrations.cron ? 'Configuré' : 'Non défini'}
          </span>
        </li>
        <li className="flex justify-between gap-2 border-b border-border/60 py-2">
          <span className="text-muted-foreground">Discord bot (DISCORD_BOT_TOKEN)</span>
          <span
            className={integrations.discordToken ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}
          >
            {integrations.discordToken ? 'Configuré' : 'Non défini'}
          </span>
        </li>
        <li className="flex justify-between gap-2 border-b border-border/60 py-2">
          <span className="text-muted-foreground">Discord serveur (DISCORD_GUILD_ID)</span>
          <span
            className={integrations.discordGuild ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}
          >
            {integrations.discordGuild ? 'Configuré' : 'Non défini'}
          </span>
        </li>
        <li className="flex justify-between gap-2 border-b border-border/60 py-2">
          <span className="text-muted-foreground">Discord sync tâches (DISCORD_TASK_SYNC_ENABLED)</span>
          <span
            className={integrations.discordSync ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}
          >
            {integrations.discordSync ? 'Activé' : 'Désactivé (test seul)'}
          </span>
        </li>
        <li className="flex justify-between gap-2 py-2">
          <span className="text-muted-foreground">URL app (NEXT_PUBLIC_APP_URL)</span>
          <span className="max-w-[55%] truncate text-xs text-foreground">{integrations.appUrl || '—'}</span>
        </li>
      </ul>
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
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
        <p className="mt-2">
          Discord Phase 1 : routes de salons via <code className="text-[10px]">GET/POST /api/discord/admin</code>{' '}
          (admin). Aucun cron Discord supplémentaire.
        </p>
      </div>

      <CriticalSoundTestAdminButton />
    </section>
  );
}
