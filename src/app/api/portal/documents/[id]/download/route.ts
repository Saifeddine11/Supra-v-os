import { validatePortalToken } from '@/lib/portal/validate';
import { createAdminClient } from '@/lib/supabase/admin';
import { createDocumentSignedUrl } from '@/lib/storage/document-storage';

export const runtime = 'nodejs';

/**
 * Portal clients: signed download only when the row is visible_to_client and belongs to the token client.
 * Internal-only documents never get a link from the portal.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const clientId = searchParams.get('clientId')?.trim();

  if (!clientId) {
    return new Response('Paramètre clientId requis.', { status: 400 });
  }

  const validation = await validatePortalToken(clientId, token);
  if (!validation.ok) {
    return new Response('Accès refusé.', { status: 403 });
  }

  const admin = createAdminClient();
  const { data: doc, error } = await admin
    .from('documents')
    .select('client_id, visible_to_client, file_storage_path')
    .eq('id', id)
    .maybeSingle();

  if (error || !doc) {
    return new Response('Document introuvable.', { status: 404 });
  }

  if (doc.client_id !== clientId) {
    return new Response('Accès refusé.', { status: 403 });
  }

  if (!doc.visible_to_client) {
    return new Response('Non disponible.', { status: 404 });
  }

  if (!doc.file_storage_path) {
    return new Response('Aucun fichier sur le stockage.', { status: 404 });
  }

  const url = await createDocumentSignedUrl(doc.file_storage_path, 120);
  if (!url) {
    return new Response('Impossible de générer le lien sécurisé.', { status: 500 });
  }

  return Response.redirect(url, 302);
}
