'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PortalVideoRow } from '@/lib/portal/load-public-data';
import { VIDEO_PUBLIC_STATUS_MAP } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { portalApproveVideoAction, portalRequestRevisionAction } from './actions';

function canActOnVideo(v: PortalVideoRow): boolean {
  return (
    v.public_status === 'in_validation' ||
    v.status === 'sent_to_client' ||
    v.status === 'internal_review'
  );
}

export function PortalVideoActions({
  clientId,
  token,
  video,
}: {
  clientId: string;
  token: string;
  video: PortalVideoRow;
}) {
  const router = useRouter();
  const [comment, setComment] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const show = canActOnVideo(video);

  if (!show) return null;

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-primary/30 bg-card p-3">
      <p className="text-xs font-medium text-primary">Action requise — {VIDEO_PUBLIC_STATUS_MAP[video.public_status].label}</p>
      {err ? <p className="text-xs text-destructive">{err}</p> : null}
      <div className="flex flex-wrap gap-2">
        <ConfirmDialog
          title="Valider cette vidéo ?"
          description="Vous confirmez que le contenu vous convient. L’équipe sera notifiée."
          confirmLabel="Approuver"
          variant="default"
          onConfirm={() =>
            new Promise<void>((resolve) => {
              setErr(null);
              startTransition(async () => {
                const res = await portalApproveVideoAction(clientId, video.id, token);
                if (!res.ok) setErr(res.error);
                router.refresh();
                resolve();
              });
            })
          }
        >
          <Button type="button" size="sm" variant="primary" className="rounded-full" disabled={pending}>
            Approuver
          </Button>
        </ConfirmDialog>
      </div>
      <div className="space-y-2">
        <Textarea
          placeholder="Décrivez les révisions souhaitées…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="border-border bg-card text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || !comment.trim()}
          className="rounded-full border-primary/40"
          onClick={() => {
            setErr(null);
            startTransition(async () => {
              const res = await portalRequestRevisionAction(clientId, video.id, token, comment);
              if (!res.ok) {
                setErr(res.error);
                return;
              }
              setComment('');
              router.refresh();
            });
          }}
        >
          Demander une révision
        </Button>
      </div>
    </div>
  );
}
