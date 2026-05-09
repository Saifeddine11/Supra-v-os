import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { assertDocumentRecordVisible } from '@/lib/auth/data-scope';
import { createDocumentSignedUrl, documentStoragePathBelongsToClient } from '@/lib/storage/document-storage';

export const runtime = 'nodejs';

/** Staff: redirect to a short-lived signed URL for Storage-backed documents. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Non authentifié.', { status: 401 });
  }

  const ctx = await getAuthContext();
  if (!ctx?.role) {
    return new Response('Accès refusé.', { status: 403 });
  }

  const { data: doc, error } = await supabase
    .from('documents')
    .select('file_storage_path, client_id, project_id, video_id')
    .eq('id', id)
    .maybeSingle();

  if (error || !doc?.file_storage_path) {
    return new Response('Fichier introuvable ou non hébergé sur le stockage.', { status: 404 });
  }

  const visible = await assertDocumentRecordVisible(supabase, ctx, {
    client_id: doc.client_id,
    project_id: doc.project_id,
    video_id: doc.video_id,
  });
  if (!visible) {
    return new Response('Accès refusé.', { status: 403 });
  }

  if (doc.client_id) {
    if (!documentStoragePathBelongsToClient(doc.file_storage_path, doc.client_id)) {
      console.warn('[documents/download] chemin stockage incohérent avec le client', { documentId: id });
      return new Response('Fichier non disponible.', { status: 404 });
    }
  } else {
    console.warn('[documents/download] document sans client_id', { documentId: id });
  }

  const url = await createDocumentSignedUrl(doc.file_storage_path, 120);
  if (!url) {
    return new Response('Impossible de générer le lien sécurisé.', { status: 500 });
  }

  return Response.redirect(url, 302);
}
