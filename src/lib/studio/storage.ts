import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { STUDIO_MEDIA_BUCKET, STUDIO_SOURCE_BUCKET } from '@/lib/studio/constants';

export function sanitizeFileName(name: string): string {
  const base = name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 180);
  return base || 'file';
}

// ─── Path builders ──────────────────────────────────────────────────────────
export function sourceMasterPath(clientId: string, sourceVideoId: string, fileName: string): string {
  return `${clientId}/${sourceVideoId}/original_${sanitizeFileName(fileName)}`;
}

export function proxyPath(clientId: string, sourceVideoId: string): string {
  return `${clientId}/${sourceVideoId}/proxy.mp4`;
}

export function thumbnailPath(clientId: string, sourceVideoId: string): string {
  return `${clientId}/${sourceVideoId}/thumb.jpg`;
}

export function waveformPath(clientId: string, sourceVideoId: string): string {
  return `${clientId}/${sourceVideoId}/waveform.json`;
}

export function exportPath(clientId: string, clipId: string): string {
  return `${clientId}/clips/${clipId}/export_${Date.now()}.mp4`;
}

export function brandAssetPath(clientId: string, kitId: string, kind: string, fileName: string): string {
  return `${clientId}/brand/${kitId}/${kind}_${sanitizeFileName(fileName)}`;
}

/** Guards that a path lives under the expected client folder. */
export function pathBelongsToClient(storagePath: string, clientId: string | null): boolean {
  if (!storagePath || !clientId) return false;
  if (storagePath.includes('..') || storagePath.startsWith('/')) return false;
  return storagePath.startsWith(`${clientId}/`);
}

// ─── Signed URLs (private media — always server-side) ────────────────────────
export async function signedMediaUrl(storagePath: string, expiresSec = 3600): Promise<string | null> {
  return signedUrl(STUDIO_MEDIA_BUCKET, storagePath, expiresSec);
}

export async function signedSourceUrl(storagePath: string, expiresSec = 3600): Promise<string | null> {
  return signedUrl(STUDIO_SOURCE_BUCKET, storagePath, expiresSec);
}

async function signedUrl(bucket: string, storagePath: string, expiresSec: number): Promise<string | null> {
  if (!storagePath) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(storagePath, expiresSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function removeMediaObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const admin = createAdminClient();
  await admin.storage.from(STUDIO_MEDIA_BUCKET).remove(paths);
}

export async function removeSourceObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const admin = createAdminClient();
  await admin.storage.from(STUDIO_SOURCE_BUCKET).remove(paths);
}

export function isStudioStorageConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(url && key);
}
