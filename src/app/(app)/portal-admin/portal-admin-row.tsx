'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Copy, RefreshCw, Power, PowerOff } from 'lucide-react';
import type { PortalAdminListRow } from '@/lib/data/portal-admin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ensurePortalWithNewTokenAction, setPortalActiveAction } from '@/app/(app)/clients/portal-actions';

function portalUrl(clientId: string, token: string) {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const envBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const root = base || envBase || '';
  return `${root}/portal/client/${clientId}?token=${encodeURIComponent(token)}`;
}

export function PortalAdminRow({ row, canManage }: { row: PortalAdminListRow; canManage: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const portal = row.portal;
  const hasToken = Boolean(portal?.token);
  const active = portal?.is_active ?? false;

  async function copyLink() {
    if (!portal?.token) {
      setMsg('Générez un jeton d’abord.');
      return;
    }
    await navigator.clipboard.writeText(portalUrl(row.client.id, portal.token));
    setMsg('Lien copié.');
    setTimeout(() => setMsg(null), 2500);
  }

  return (
    <tr className="bg-card/40 transition-colors hover:bg-accent/30">
      <td className="px-4 py-3">
        <Link href={`/clients/${row.client.id}`} className="font-medium text-foreground hover:text-primary">
          {row.client.name}
        </Link>
        <p className="text-xs text-muted-foreground">{row.client.email ?? '—'}</p>
      </td>
      <td className="px-4 py-3">
        {hasToken ? (
          <Badge variant={active ? 'default' : 'outline'} className="font-normal">
            {active ? 'Actif' : 'Inactif'}
          </Badge>
        ) : (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            Sans jeton
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 tabular-nums text-muted-foreground">{row.visible_quotes}</td>
      <td className="px-4 py-3 tabular-nums text-muted-foreground">{row.visible_documents}</td>
      <td className="px-4 py-3 tabular-nums text-muted-foreground">{row.visible_reports}</td>
      <td className="px-4 py-3 tabular-nums text-muted-foreground">{row.pending_validations}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {portal?.last_accessed_at
          ? new Date(portal.last_accessed_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
          : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        {canManage ? (
          <div className="flex flex-wrap justify-end gap-1">
            <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => void copyLink()}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={async () => {
                setMsg(null);
                const res = await ensurePortalWithNewTokenAction(row.client.id);
                if (!res.ok) setMsg(res.error);
                router.refresh();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            {active ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={async () => {
                  await setPortalActiveAction(row.client.id, false);
                  router.refresh();
                }}
              >
                <PowerOff className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={async () => {
                  await setPortalActiveAction(row.client.id, true);
                  router.refresh();
                }}
              >
                <Power className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Lecture</span>
        )}
        {msg ? <p className="mt-1 text-xs text-primary">{msg}</p> : null}
      </td>
    </tr>
  );
}
