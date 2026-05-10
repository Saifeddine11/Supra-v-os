'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AgencyMonthlyGoalRow } from '@/types/database';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { upsertAgencyMonthlyGoalAction } from '@/app/(app)/settings/monthly-goals-actions';
import { Loader2 } from 'lucide-react';

export function MonthlyGoalsSection({
  year,
  month,
  monthLabel,
  prevHref,
  nextHref,
  initialGoal,
}: {
  year: number;
  month: number;
  monthLabel: string;
  prevHref: string;
  nextHref: string;
  initialGoal: AgencyMonthlyGoalRow | null;
}) {
  const [revenue, setRevenue] = useState(
    initialGoal ? String(initialGoal.revenue_goal) : ''
  );
  const [clientGoal, setClientGoal] = useState(
    initialGoal?.client_goal != null ? String(initialGoal.client_goal) : ''
  );
  const [videoGoal, setVideoGoal] = useState(
    initialGoal?.video_goal != null ? String(initialGoal.video_goal) : ''
  );
  const [taskGoal, setTaskGoal] = useState(
    initialGoal?.task_goal != null ? String(initialGoal.task_goal) : ''
  );
  const [notes, setNotes] = useState(initialGoal?.notes ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <SectionCard
      id="objectifs-mensuels"
      title="Objectifs mensuels"
      description="Objectif CA et indicateurs optionnels pour le tableau de bord — lecture par toute l’équipe connectée, modification admin uniquement."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="rounded-full" asChild>
          <Link href={prevHref}>Mois précédent</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" className="rounded-full" asChild>
          <Link href={nextHref}>Mois suivant</Link>
        </Button>
        <span className="text-sm font-medium capitalize text-foreground">{monthLabel}</span>
        <Link href="/dashboard" className="ml-auto text-xs font-semibold text-primary hover:underline">
          Voir le dashboard
        </Link>
      </div>

      <form
        className="grid max-w-xl gap-4"
        action={(fd) => {
          setErr(null);
          setOk(null);
          startTransition(async () => {
            const res = await upsertAgencyMonthlyGoalAction(fd);
            if (!res.ok) {
              setErr(res.error);
              return;
            }
            setOk('Objectif enregistré.');
            router.refresh();
          });
        }}
      >
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />
        <div className="grid gap-2">
          <Label htmlFor="revenue_goal">Objectif chiffre d’affaires (MAD)</Label>
          <Input
            id="revenue_goal"
            name="revenue_goal"
            type="number"
            min={0}
            step="0.01"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
            placeholder="ex. 220000"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
          <div className="grid gap-2">
            <Label htmlFor="client_goal">Clients actifs (optionnel)</Label>
            <Input
              id="client_goal"
              name="client_goal"
              type="number"
              min={0}
              step={1}
              value={clientGoal}
              onChange={(e) => setClientGoal(e.target.value)}
              placeholder="—"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="video_goal">Vidéos livrées (optionnel)</Label>
            <Input
              id="video_goal"
              name="video_goal"
              type="number"
              min={0}
              step={1}
              value={videoGoal}
              onChange={(e) => setVideoGoal(e.target.value)}
              placeholder="—"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task_goal">Tâches clôturées (optionnel)</Label>
            <Input
              id="task_goal"
              name="task_goal"
              type="number"
              min={0}
              step={1}
              value={taskGoal}
              onChange={(e) => setTaskGoal(e.target.value)}
              placeholder="—"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="goal-notes">Notes internes</Label>
          <Textarea
            id="goal-notes"
            name="notes"
            rows={3}
            className="resize-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Rappels pour l’équipe (non affichés côté client)."
          />
        </div>
        {ok ? (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400" role="status">
            {ok}
          </p>
        ) : null}
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        <Button type="submit" variant="primary" className="w-fit rounded-full" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement…
            </>
          ) : (
            'Enregistrer l’objectif'
          )}
        </Button>
      </form>
    </SectionCard>
  );
}
