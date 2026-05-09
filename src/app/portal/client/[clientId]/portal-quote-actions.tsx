'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QuoteStatus } from '@/types/database';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';

export function PortalQuoteActions({
  quoteId,
  clientId,
  token,
  status,
}: {
  quoteId: string;
  clientId: string;
  token: string;
  status: QuoteStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (status !== 'sent') {
    return (
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Réponse en ligne réservée aux propositions « Envoyées ». Pour toute question sur ce dossier, contactez votre
        chargé de compte Supra v.
      </p>
    );
  }

  async function postDecision(decision: 'accept' | 'refuse') {
    setPending(true);
    setMsg(null);
    try {
      const url = new URL(`/api/portal/quotes/${quoteId}/respond`, window.location.origin);
      url.searchParams.set('clientId', clientId);
      url.searchParams.set('token', token);
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMsg(data.error ?? 'Action impossible pour le moment.');
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {msg ? <p className="text-xs text-destructive">{msg}</p> : null}
      <div className="flex flex-wrap gap-2">
        <ConfirmDialog
          title="Accepter cette proposition ?"
          description="Vous confirmez accepter le périmètre et les montants tels qu’indiqués dans le PDF. Un accusé sera transmis à l’équipe."
          confirmLabel="Accepter"
          onConfirm={() => postDecision('accept')}
        >
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="rounded-full text-xs"
            disabled={pending}
          >
            Accepter
          </Button>
        </ConfirmDialog>
        <ConfirmDialog
          title="Refuser cette proposition ?"
          description="Le statut passera à « Refusé ». Vous pouvez préciser votre décision auprès de votre interlocuteur."
          confirmLabel="Refuser"
          variant="destructive"
          onConfirm={() => postDecision('refuse')}
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full border-border text-xs"
            disabled={pending}
          >
            Refuser
          </Button>
        </ConfirmDialog>
      </div>
    </div>
  );
}
