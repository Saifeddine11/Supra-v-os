'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  approveClientVideoAction,
  requestClientVideoRevisionAction,
} from '@/app/client/(authenticated)/actions';

export function ClientVideoActions({ videoId }: { videoId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="w-full max-w-sm space-y-2">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <ConfirmDialog
        title="Valider cette vidéo ?"
        description="Vous confirmez que le contenu vous convient. L’équipe Supra sera notifiée."
        confirmLabel="Valider"
        variant="default"
        onConfirm={() =>
          new Promise<void>((resolve) => {
            setError(null);
            startTransition(async () => {
              const res = await approveClientVideoAction(videoId);
              if (!res.ok) setError(res.error);
              router.refresh();
              resolve();
            });
          })
        }
      >
        <Button type="button" size="sm" variant="primary" className="rounded-full" disabled={pending}>
          Valider
        </Button>
      </ConfirmDialog>
      <label className="block">
        <span className="sr-only">Modifications souhaitées</span>
        <Textarea
          placeholder="Décrivez les modifications souhaitées…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="text-sm"
        />
      </label>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-full"
        disabled={pending || !comment.trim()}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await requestClientVideoRevisionAction(videoId, comment);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setComment('');
            router.refresh();
          });
        }}
      >
        Demander une modification
      </Button>
    </div>
  );
}
