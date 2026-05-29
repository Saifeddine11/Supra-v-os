'use client';

import { Button } from '@/components/ui/button';
import type { DraftReferencePreview } from '@/lib/ai/draft-resolution-ui';

type DraftReferenceAmbiguousPickerProps = {
  kind: 'client' | 'assignee';
  preview: DraftReferencePreview;
  onSelect: (id: string, label: string) => void;
};

export function DraftReferenceAmbiguousPicker({
  kind,
  preview,
  onSelect,
}: DraftReferenceAmbiguousPickerProps) {
  if (preview.status !== 'ambiguous' || !preview.matches?.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {preview.matches.map((match) => (
        <Button
          key={match.id}
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => onSelect(match.id, match.label)}
        >
          {kind === 'client' ? 'Client' : 'Assigner'} : {match.label}
        </Button>
      ))}
    </div>
  );
}

type DraftReferenceResolvedHintProps = {
  hint: string | null;
};

export function DraftReferenceResolvedHint({ hint }: DraftReferenceResolvedHintProps) {
  if (!hint) return null;
  return (
    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">{hint}</p>
  );
}
