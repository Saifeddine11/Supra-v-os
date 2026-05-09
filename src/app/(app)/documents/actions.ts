'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/permissions';
import { canModifyClients } from '@/lib/auth/capabilities';
import {
  assertClientRecordVisible,
  assertDocumentRecordVisible,
  assertProjectIdAccessible,
} from '@/lib/auth/data-scope';
import { actionError, actionOk, getPostgrestError, type ActionResult } from '@/lib/actions/types';
import type { DocumentType } from '@/types/database';
import { logStaffActivity } from '@/lib/activity/log-activity';
import { isSupabaseStorageUploadConfigured } from '@/lib/storage/buckets';
import {
  documentStoragePathBelongsToClient,
  removeDocumentObject,
  uploadDocumentObject,
} from '@/lib/storage/document-storage';

export async function createDocumentAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyClients(ctx.role)) {
    return actionError('Droits insuffisants pour ajouter un document.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionError('Session expirée.');

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return actionError('Le nom est requis.');

  const clientId = String(formData.get('client_id') ?? '').trim();
  if (!clientId) return actionError('Le client est requis.');
  if (!(await assertClientRecordVisible(supabase, ctx, clientId))) {
    return actionError('Client non autorisé pour ce document.');
  }

  const projectId = String(formData.get('project_id') ?? '').trim();
  if (projectId) {
    if (!(await assertProjectIdAccessible(supabase, ctx, projectId))) {
      return actionError('Projet inaccessible.');
    }
    const { data: proj } = await supabase.from('projects').select('client_id').eq('id', projectId).maybeSingle();
    if (!proj || proj.client_id !== clientId) {
      return actionError('Le projet ne correspond pas au client sélectionné.');
    }
  }
  const docType = String(formData.get('type') ?? 'other').trim() as DocumentType;
  const description = String(formData.get('description') ?? '').trim() || null;
  let fileUrl = String(formData.get('file_url') ?? '').trim() || null;
  const externalLink = String(formData.get('external_link') ?? '').trim() || null;
  const visibleToClient = formData.getAll('visible_to_client').includes('true');

  const fileField = formData.get('file');
  let fileStoragePath: string | null = null;
  let mimeType: string | null = null;
  let fileSize: number | null = null;

  if (fileField instanceof File && fileField.size > 0) {
    if (!isSupabaseStorageUploadConfigured()) {
      return actionError(
        'Upload impossible : configurez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY, ' +
          'et appliquez la migration des buckets Storage (voir supabase/migrations).'
      );
    }
    try {
      const up = await uploadDocumentObject(clientId, fileField);
      fileStoragePath = up.path;
      mimeType = up.mimeType;
      fileSize = up.size;
      fileUrl = null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Échec upload.';
      return actionError(msg);
    }
  }

  if (!fileStoragePath && !fileUrl && !externalLink) {
    return actionError('Ajoutez un fichier, une URL de fichier, ou un lien externe.');
  }

  const { data: row, error } = await supabase
    .from('documents')
    .insert({
      name,
      client_id: clientId || null,
      project_id: projectId || null,
      type: docType,
      description,
      file_url: fileUrl,
      file_storage_path: fileStoragePath,
      file_size: fileSize,
      mime_type: mimeType,
      external_link: externalLink,
      visible_to_client: visibleToClient,
      uploaded_by: user.id,
    })
    .select('id')
    .single();

  if (error || !row) return actionError(error ? getPostgrestError(error) : 'Échec création document.');

  await logStaffActivity(ctx, {
    action: 'created',
    entityType: 'document',
    entityId: row.id,
    metadata: { name, client_id: clientId, storage: Boolean(fileStoragePath) },
  });

  revalidatePath('/documents');
  revalidatePath('/dashboard');
  if (clientId) revalidatePath(`/clients/${clientId}`);
  return actionOk({ id: row.id });
}

export async function archiveDocumentAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyClients(ctx.role)) return actionError('Droits insuffisants.');

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from('documents')
    .select('client_id, project_id, video_id, name')
    .eq('id', id)
    .maybeSingle();
  if (
    !doc ||
    !(await assertDocumentRecordVisible(supabase, ctx, {
      client_id: doc.client_id,
      project_id: doc.project_id,
      video_id: doc.video_id,
    }))
  ) {
    return actionError('Document inaccessible.');
  }

  const { error } = await supabase
    .from('documents')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'archived',
    entityType: 'document',
    entityId: id,
    metadata: { name: doc?.name },
  });

  revalidatePath('/documents');
  revalidatePath('/dashboard');
  if (doc?.client_id) revalidatePath(`/clients/${doc.client_id}`);
  return actionOk();
}

export async function deleteDocumentAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !canModifyClients(ctx.role)) return actionError('Droits insuffisants.');

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from('documents')
    .select('client_id, project_id, video_id, file_storage_path, name')
    .eq('id', id)
    .maybeSingle();
  if (
    !doc ||
    !(await assertDocumentRecordVisible(supabase, ctx, {
      client_id: doc.client_id,
      project_id: doc.project_id,
      video_id: doc.video_id,
    }))
  ) {
    return actionError('Document inaccessible.');
  }

  if (
    doc.file_storage_path &&
    isSupabaseStorageUploadConfigured() &&
    documentStoragePathBelongsToClient(doc.file_storage_path, doc.client_id)
  ) {
    try {
      await removeDocumentObject(doc.file_storage_path);
    } catch {
      /* continue row delete even if object missing */
    }
  }

  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) return actionError(getPostgrestError(error));

  await logStaffActivity(ctx, {
    action: 'deleted',
    entityType: 'document',
    entityId: id,
    metadata: { name: doc?.name },
  });

  revalidatePath('/documents');
  revalidatePath('/dashboard');
  if (doc?.client_id) revalidatePath(`/clients/${doc.client_id}`);
  return actionOk();
}
