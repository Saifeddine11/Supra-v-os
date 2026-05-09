'use client';

import { useEffect, useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { UserNotificationPreferencesRow } from '@/types/database';
import { DEFAULT_NOTIFICATION_PREFS } from '@/data/notification-defaults';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { updateNotificationPreferencesAction } from '@/app/(app)/settings/actions';

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

  const p = prefs
    ? {
        email_reminders_enabled: prefs.email_reminders_enabled,
        morning_reminder_enabled: prefs.morning_reminder_enabled,
        evening_summary_enabled: prefs.evening_summary_enabled,
        deadline_alerts_enabled: prefs.deadline_alerts_enabled,
      }
    : DEFAULT_NOTIFICATION_PREFS;

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
