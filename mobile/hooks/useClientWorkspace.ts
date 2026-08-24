/**
 * Données de l'espace client mobile.
 *
 * Source UNIQUE : les RPC client-safe de production
 * (supabase/migrations/20260823162513_client_users_portal_rpcs.sql) —
 *   portal_my_client()   → organisation cliente + identité du contact
 *   portal_my_projects() → projets du client uniquement
 *   portal_my_videos()   → vidéos du client, `public_status` seulement
 *
 * Ces fonctions sont SECURITY DEFINER, scopées par `auth_client_id()`
 * (fail-closed : null pour le staff et pour un compte inactif) et exécutables
 * par le rôle `authenticated`. Le mobile n'interroge donc JAMAIS directement
 * `videos`, `projects` ou `clients` : aucune colonne interne ne peut fuiter,
 * et aucune route API supplémentaire n'est nécessaire.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logDevError, toUserMessage } from '@/lib/errors';

export interface ClientIdentity {
  id: string;
  name: string;
  monthly_video_quota: number | null;
  currency: string | null;
  color_hex: string | null;
  color_label: string | null;
  client_user_id: string;
  full_name: string | null;
  email: string;
  must_change_password: boolean;
}

export interface ClientProject {
  id: string;
  title: string;
  status: string;
  progress: number | null;
  deadline: string | null;
  type: string | null;
  delivered_at: string | null;
}

export interface ClientVideo {
  id: string;
  title: string;
  public_status: string;
  shooting_date: string | null;
  delivery_deadline: string | null;
  client_delivery_at: string | null;
  publication_date: string | null;
  preview_url: string | null;
  final_url: string | null;
}

/** Identité cliente — sert aussi de détection de compte (voir useAuth). */
export async function fetchClientIdentity(): Promise<ClientIdentity | null> {
  const { data, error } = await supabase.rpc('portal_my_client');
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ClientIdentity[];
  return rows[0] ?? null;
}

export async function fetchClientProjects(): Promise<ClientProject[]> {
  const { data, error } = await supabase.rpc('portal_my_projects');
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientProject[];
}

export async function fetchClientVideos(): Promise<ClientVideo[]> {
  const { data, error } = await supabase.rpc('portal_my_videos');
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientVideo[];
}

export interface ClientWorkspaceData {
  client: ClientIdentity | null;
  projects: ClientProject[];
  videos: ClientVideo[];
}

const EMPTY: ClientWorkspaceData = { client: null, projects: [], videos: [] };

/**
 * Charge l'espace client complet (3 RPC bornées, en parallèle).
 * Volume attendu par client : quelques dizaines de lignes — pas de pagination
 * nécessaire à ce stade.
 */
export function useClientWorkspace() {
  const [data, setData] = useState<ClientWorkspaceData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [client, projects, videos] = await Promise.all([
        fetchClientIdentity(),
        fetchClientProjects(),
        fetchClientVideos(),
      ]);
      setData({ client, projects, videos });
    } catch (e) {
      logDevError('useClientWorkspace', e);
      setError(toUserMessage(e));
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    load().finally(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { data, loading, refreshing, error, refresh, reload: load };
}

// ─── Dérivations planning (aucune RPC dédiée côté production) ───────────────

export type ClientPlanningKind = 'shooting' | 'delivery' | 'publication';

export interface ClientPlanningItem {
  key: string;
  kind: ClientPlanningKind;
  videoId: string;
  title: string;
  at: string;
  publicStatus: string;
}

/** Date de livraison effective : timestamp précis sinon date legacy (midi). */
export function effectiveDeliveryIso(v: ClientVideo): string | null {
  if (v.client_delivery_at) return v.client_delivery_at;
  if (!v.delivery_deadline) return null;
  return v.delivery_deadline.length <= 10
    ? `${v.delivery_deadline}T12:00:00.000Z`
    : v.delivery_deadline;
}

/** Événements à venir, triés — tournages, livraisons, publications. */
export function buildClientPlanning(
  videos: ClientVideo[],
  from: Date = new Date(),
): ClientPlanningItem[] {
  const items: ClientPlanningItem[] = [];
  const fromMs = from.getTime();

  for (const v of videos) {
    const push = (kind: ClientPlanningKind, iso: string | null) => {
      if (!iso) return;
      const t = new Date(iso).getTime();
      if (Number.isNaN(t) || t < fromMs) return;
      items.push({
        key: `${kind}-${v.id}`,
        kind,
        videoId: v.id,
        title: v.title,
        at: iso,
        publicStatus: v.public_status,
      });
    };

    push('shooting', v.shooting_date);
    push('delivery', effectiveDeliveryIso(v));
    push('publication', v.publication_date);
  }

  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function useClientPlanning(videos: ClientVideo[]): ClientPlanningItem[] {
  return useMemo(() => buildClientPlanning(videos), [videos]);
}
