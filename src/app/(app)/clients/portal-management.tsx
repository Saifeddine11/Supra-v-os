'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, RefreshCw, Power, PowerOff } from 'lucide-react';
import type { ClientPortal } from '@/types/database';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ensurePortalWithNewTokenAction, setPortalActiveAction } from './portal-actions';

function portalUrl(clientId: string, token: string) {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const envBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const root = base || envBase || '';
  return `${root}/portal/client/${clientId}?token=${encodeURIComponent(token)}`;
}

export function PortalManagementSection({
  clientId,
  portal,
}: {
  clientId: string;
  portal: ClientPortal | null;
}) {
  const router = useRouter();
  const [token, setToken] = useState(portal?.token ?? '');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setToken(portal?.token ?? '');
  }, [portal?.token]);

  const active = portal?.is_active ?? false;
  const displayToken = token || portal?.token || '';

  async function copyLink() {
    if (!displayToken) {
      setMsg('Générez un jeton d’abord.');
      return;
    }
    const url = portalUrl(clientId, displayToken);
    await navigator.clipboard.writeText(url);
    setMsg('Lien copié dans le presse-papiers.');
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="rounded-full"
          onClick={async () => {
            setMsg(null);
            const res = await ensurePortalWithNewTokenAction(clientId);
            if (!res.ok) {
              setMsg(res.error);
              return;
            }
            if (res.data?.token) setToken(res.data.token);
            router.refresh();
            setMsg('Nouveau jeton généré. Pensez à copier le lien.');
          }}
        >
          <RefreshCw className="h-4 w-4" />
          {portal ? 'Régénérer le jeton' : 'Générer le portail'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()} disabled={!displayToken}>
          <Copy className="h-4 w-4" />
          Copier le lien
        </Button>
        {active ? (
          <ConfirmDialog
            title="Désactiver le portail ?"
            description="Les liens existants cesseront de fonctionner jusqu’à réactivation."
            confirmLabel="Désactiver"
            onConfirm={async () => {
              await setPortalActiveAction(clientId, false);
              router.refresh();
            }}
          >
            <Button type="button" variant="outline" size="sm" className="text-orange-300">
              <PowerOff className="h-4 w-4" />
              Désactiver
            </Button>
          </ConfirmDialog>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              await setPortalActiveAction(clientId, true);
              router.refresh();
            }}
          >
            <Power className="h-4 w-4" />
            Activer
          </Button>
        )}
      </div>
      {displayToken ? (
        <div className="rounded-lg border border-border/80 bg-card p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">URL portail</p>
          <p className="mt-1 break-all font-mono text-xs text-primary">{portalUrl(clientId, displayToken)}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Aucun jeton — générez-en un pour activer l’espace client.</p>
      )}
      {msg ? <p className="text-sm text-primary">{msg}</p> : null}
    </div>
  );
}
