import { createWriteStream } from 'node:fs';
import { readFile, mkdir } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { supabase } from './supabase.js';
import { config } from './config.js';

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/** Stream a (potentially large) storage object to a local file via a signed URL. */
export async function downloadToFile(
  bucket: string,
  storagePath: string,
  destPath: string,
): Promise<void> {
  await ensureDir(path.dirname(destPath));
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) {
    throw new Error(`createSignedUrl failed for ${bucket}/${storagePath}: ${error?.message}`);
  }
  const res = await fetch(data.signedUrl);
  if (!res.ok || !res.body) {
    throw new Error(`download failed (${res.status}) for ${bucket}/${storagePath}`);
  }
  await pipeline(Readable.fromWeb(res.body as unknown as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(destPath));
}

export async function uploadFile(
  bucket: string,
  storagePath: string,
  localPath: string,
  contentType: string,
): Promise<void> {
  const buf = await readFile(localPath);
  const { error } = await supabase.storage.from(bucket).upload(storagePath, buf, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`upload failed for ${bucket}/${storagePath}: ${error.message}`);
}

export async function uploadBuffer(
  bucket: string,
  storagePath: string,
  buf: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(storagePath, buf, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`upload failed for ${bucket}/${storagePath}: ${error.message}`);
}

export const BUCKETS = {
  source: config.sourceBucket,
  media: config.mediaBucket,
};
