'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { msToTimecode, timecodeToMs, humanDuration } from '@/lib/studio/time';
import type { ClipSuggestion } from '@/types/studio';
import { acceptSuggestionAction, rejectSuggestionAction } from '../../actions';

export function SuggestionsPanel({
  sourceId,
  suggestions,
}: {
  sourceId: string;
  suggestions: ClipSuggestion[];
}) {
  const pending = suggestions.filter((s) => s.status === 'pending');

  if (pending.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune suggestion en attente. Les recommandations IA apparaîtront ici après l’analyse.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {pending.map((s) => (
        <SuggestionCard key={s.id} sourceId={sourceId} suggestion={s} />
      ))}
    </div>
  );
}

function SuggestionCard({ sourceId, suggestion }: { sourceId: string; suggestion: ClipSuggestion }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(suggestion.title);
  const [start, setStart] = useState(msToTimecode(suggestion.start_ms));
  const [end, setEnd] = useState(msToTimecode(suggestion.end_ms));

  const duration = suggestion.end_ms - suggestion.start_ms;

  async function accept(withEdits: boolean) {
    setBusy(true);
    try {
      const payload: {
        suggestionId: string;
        sourceVideoId: string;
        title?: string;
        startMs?: number;
        endMs?: number;
      } = { suggestionId: suggestion.id, sourceVideoId: sourceId };
      if (withEdits) {
        const sMs = timecodeToMs(start);
        const eMs = timecodeToMs(end);
        if (sMs == null || eMs == null || eMs <= sMs) {
          toast.error('Timecodes invalides.');
          setBusy(false);
          return;
        }
        payload.title = title.trim() || suggestion.title;
        payload.startMs = sMs;
        payload.endMs = eMs;
      }
      const res = await acceptSuggestionAction(payload);
      if (!res.ok || !res.data) throw new Error(res.ok ? 'Échec.' : res.error);
      toast.success('Clip créé.');
      router.push(`/studio/clip/${res.data.clipId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action impossible.');
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      const res = await rejectSuggestionAction(suggestion.id, sourceId);
      if (!res.ok) throw new Error(res.error);
      toast.success('Suggestion rejetée.');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action impossible.');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/70 bg-background/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {editing ? (
            <Input
              className="mb-1 h-8 border-border/70 bg-background/40"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          ) : (
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              {suggestion.title}
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {msToTimecode(suggestion.start_ms)} → {msToTimecode(suggestion.end_ms)} ·{' '}
            {humanDuration(duration)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          <span className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 font-medium text-primary">
            Viralité {Math.round(suggestion.virality_score ?? 0)}
          </span>
          <span className="text-muted-foreground">
            Confiance {Math.round(suggestion.confidence_score ?? 0)}%
          </span>
        </div>
      </div>

      {suggestion.hook ? (
        <p className="mt-3 text-sm text-foreground/90">
          <span className="text-muted-foreground">Accroche : </span>
          {suggestion.hook}
        </p>
      ) : null}
      {suggestion.main_idea ? (
        <p className="mt-1 text-sm text-foreground/90">
          <span className="text-muted-foreground">Idée : </span>
          {suggestion.main_idea}
        </p>
      ) : null}
      {suggestion.reason ? (
        <p className="mt-2 text-xs italic text-muted-foreground">{suggestion.reason}</p>
      ) : null}

      {editing ? (
        <div className="mt-3 flex items-end gap-2">
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-muted-foreground">Début</label>
            <Input
              className="h-8 w-24 border-border/70 bg-background/40 font-mono"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-muted-foreground">Fin</label>
            <Input
              className="h-8 w-24 border-border/70 bg-background/40 font-mono"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button size="sm" variant="primary" onClick={() => accept(true)} disabled={busy}>
              <Check className="h-3.5 w-3.5" /> Créer le clip
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              Annuler
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="primary" onClick={() => accept(false)} disabled={busy}>
              <Check className="h-3.5 w-3.5" /> Accepter
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={busy}>
              <Pencil className="h-3.5 w-3.5" /> Modifier
            </Button>
            <Button size="sm" variant="ghost" onClick={reject} disabled={busy}>
              <X className="h-3.5 w-3.5" /> Rejeter
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
