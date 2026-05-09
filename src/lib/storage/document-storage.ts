import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { STORAGE_BUCKETS } from '@/lib/storage/buckets';

export function sanitizeStorageFileName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 180);
  return base || 'file';
}

export async function uploadDocumentObject(
  clientId: string,
  file: File
): Promise<{ path: string; mimeType: string | null; size: number }> {
  const admin = createAdminClient();
  const safe = sanitizeStorageFileName(file.name);
  const path = `${clientId}/${crypto.randomUUID()}_${safe}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(STORAGE_BUCKETS.documents).upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return { path, mimeType: file.type || null, size: file.size };
}

/** Empêche la suppression d’un objet hors du dossier client attendu (path = `{clientId}/...`). */
export function documentStoragePathBelongsToClient(storagePath: string, clientId: string | null): boolean {
  if (!storagePath || !clientId) return false;
  if (storagePath.includes('..') || storagePath.startsWith('/')) return false;
  return storagePath.startsWith(`${clientId}/`);
}

export async function removeDocumentObject(storagePath: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(STORAGE_BUCKETS.documents).remove([storagePath]);
  if (error) throw new Error(error.message);
}

export async function createDocumentSignedUrl(
  storagePath: string,
  expiresSec: number
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(STORAGE_BUCKETS.documents)
    .createSignedUrl(storagePath, expiresSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
