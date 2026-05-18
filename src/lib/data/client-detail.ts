import { createClient } from '@/lib/supabase/server';
import type { AuthContext } from '@/lib/auth/permissions';
import { getAuthContext } from '@/lib/auth/permissions';
import { canViewInvoices } from '@/lib/auth/capabilities';
import { assertClientRecordVisible } from '@/lib/auth/data-scope';
import type { ClientPortal, DocumentRecord, Invoice, Project, Video } from '@/types/database';

export interface ClientDetailBundle {
  portal: ClientPortal | null;
  projects: Project[];
  videos: Video[];
  invoices: Pick<Invoice, 'id' | 'ref' | 'status' | 'total' | 'due_date' | 'issue_date'>[];
  documents: DocumentRecord[];
}

export async function getClientRelations(
  clientId: string,
  ctx: AuthContext | null = null
): Promise<ClientDetailBundle> {
  const auth = ctx ?? (await getAuthContext());
  const supabase = await createClient();
  if (!auth?.role || !(await assertClientRecordVisible(supabase, auth, clientId))) {
    return { portal: null, projects: [], videos: [], invoices: [], documents: [] };
  }

  const includeInvoices = canViewInvoices(auth.role);

  const [portalRes, projRes, vidRes, invRes, docRes] = await Promise.all([
    supabase.from('client_portals').select('*').eq('client_id', clientId).maybeSingle(),
    supabase.from('projects').select('*').eq('client_id', clientId).order('updated_at', { ascending: false }),
    supabase.from('videos').select('*').eq('client_id', clientId).order('updated_at', { ascending: false }),
    includeInvoices
      ? supabase
          .from('invoices')
          .select('id, ref, status, total, due_date, issue_date')
          .eq('client_id', clientId)
          .order('issue_date', { ascending: false })
      : Promise.resolve({ data: [] as ClientDetailBundle['invoices'], error: null }),
    supabase.from('documents').select('*').eq('client_id', clientId).order('uploaded_at', { ascending: false }),
  ]);

  return {
    portal: portalRes.data ?? null,
    projects: projRes.data ?? [],
    videos: vidRes.data ?? [],
    invoices: includeInvoices ? ((invRes.data ?? []) as ClientDetailBundle['invoices']) : [],
    documents: docRes.data ?? [],
  };
}
