'use client';

import { useEffect, useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { UserNotificationPreferencesRow } from '@/types/database';
import { DEFAULT_NOTIFICATION_PREFS } from '@/data/notification-defaults';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { updateNotificationPreferencesAction } from '@/app/(app)/settings/actions';
import type { NotificationSoundPrefs } from '@/lib/notifications/notification-sound-prefs';
import { NotificationSoundTestButtons } from '@/components/settings/notification-sound-test-buttons';

function FormFeedback({ kind, message }: { kind: 'success' | 'error'; message: string }) {
  if (kind === 'success') {
    return (
      <div
        role="status"
        className="rounded-xl border border-primary/50 bg-gradient-to-br from-primary/[0.14] to-primary/[0.06] px-4 py-3 text-sm text-foreground shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.2)]"
      >
        <span className="font-medium text-primary">{message}</span>
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </div>
  );
}

function ToggleRow({
  name,
  label,
  description,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/60 border-l-2 border-l-primary/60 bg-card/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:bg-card/50">
      <div>
        <Label className="text-foreground">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <label className="flex items-center gap-2">
        <input type="hidden" name={name} value="false" />
        <input
          type="checkbox"
          name={name}
          value="true"
          defaultChecked={defaultChecked}
          disabled={disabled}
          className="h-4 w-4 rounded border-input accent-primary"
        />
      </label>
    </div>
  );
}

export function NotificationPreferencesForm({
  prefs,
}: {
  prefs: UserNotificationPreferencesRow | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (feedback?.kind !== 'success') return;
    const t = window.setTimeout(() => setFeedback(null), 4500);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const p = { ...DEFAULT_NOTIFICATION_PREFS, ...(prefs ?? {}) };

  const soundPrefsForTest: NotificationSoundPrefs = {
    notification_sound_enabled: p.notification_sound_enabled,
    notification_sound_urgent_only: p.notification_sound_urgent_only,
    notification_sound_volume: p.notification_sound_volume,
  };

  return (
    <form
      className="grid max-w-2xl gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setFeedback(null);
        startTransition(async () => {
          const res = await updateNotificationPreferencesAction(formData);
          if (res.ok) {
            setFeedback({ kind: 'success', text: 'Préférences enregistrées.' });
            router.refresh();
          } else {
            setFeedback({ kind: 'error', text: res.error });
          }
        });
      }}
    >
      {feedback ? <FormFeedback kind={feedback.kind} message={feedback.text} /> : null}

      <div className="rounded-xl border border-destructive/35 bg-destructive/[0.07] px-4 py-3 text-sm text-foreground">
        <p className="font-semibold text-destructive">Alertes critiques — non désactivables</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Les retards et situations critiques (tâches, livraisons vidéo, factures selon votre rôle), le bandeau rouge en
          haut de l’app, les rappels e-mail toutes les 2 h et le son critique associé sont obligatoires pour l’équipe.
          Les réglages ci-dessous ne s’appliquent pas à ces alertes.
        </p>
      </div>

      <ToggleRow
        name="email_reminders_enabled"
        label="Emails automatiques (cron)"
        description="Si désactivé, aucun email Resend n’est envoyé pour les rappels ci-dessous."
        defaultChecked={p.email_reminders_enabled}
        disabled={pending}
      />
      <ToggleRow
        name="morning_reminder_enabled"
        label="Rappel matinal (lun–ven)"
        description="Notifications + email selon vos tâches du jour (cron 7h30)."
        defaultChecked={p.morning_reminder_enabled}
        disabled={pending}
      />
      <ToggleRow
        name="evening_summary_enabled"
        label="Bilan de fin de journée"
        description="Récapitulatif tâches (cron 18h30)."
        defaultChecked={p.evening_summary_enabled}
        disabled={pending}
      />
      <ToggleRow
        name="deadline_alerts_enabled"
        label="Alertes échéances"
        description="Tâches, vidéos, factures et devis — notifications et emails (cron journée)."
        defaultChecked={p.deadline_alerts_enabled}
        disabled={pending}
      />

      <div className="mt-4 space-y-3 rounded-xl border border-border/60 border-l-2 border-l-primary/50 bg-card/30 p-4 dark:bg-card/40">
        <div>
          <p className="text-sm font-medium text-foreground">Notifications sonores</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Activez un son court pour les notifications importantes et urgentes. Les alertes mineures restent silencieuses
            dans l’app.
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground/90">
            Si le navigateur bloque l’audio, cliquez une fois dans l’app ou utilisez « Tester » ci-dessous pour
            débloquer.
          </p>
        </div>
        <ToggleRow
          name="notification_sound_enabled"
          label="Activer les sons"
          description="Si désactivé, aucun son ne sera joué pour les nouvelles notifications."
          defaultChecked={p.notification_sound_enabled}
          disabled={pending}
        />
        <ToggleRow
          name="notification_sound_urgent_only"
          label="Sons uniquement pour urgences"
          description="Seules les alertes urgentes ou critiques produisent un son (échéances imminentes, retards, factures critiques)."
          defaultChecked={p.notification_sound_urgent_only}
          disabled={pending}
        />
        <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Label className="text-foreground">Volume</Label>
            <p className="text-xs text-muted-foreground">Faible, moyen ou fort (appliqué aux sons in-app).</p>
          </div>
          <select
            name="notification_sound_volume"
            defaultValue={p.notification_sound_volume}
            disabled={pending}
            className="h-9 rounded-lg border border-border/80 bg-card px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value="low">Faible</option>
            <option value="medium">Moyen</option>
            <option value="high">Fort</option>
          </select>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tester</p>
          <NotificationSoundTestButtons prefs={soundPrefsForTest} />
        </div>
      </div>

      <Button type="submit" variant="outline" className="mt-2 w-fit rounded-full border-primary/35" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enregistrement…
          </>
        ) : (
          'Enregistrer mes préférences'
        )}
      </Button>
    </form>
  );
}
