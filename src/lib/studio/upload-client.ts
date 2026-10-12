'use client';

import * as tus from 'tus-js-client';
import { normalizeSupabaseProjectUrl } from '@/lib/supabase/normalize-url';

/**
 * Resumable (TUS) upload of a large source video directly to Supabase Storage.
 * Authenticated with the user's own access token (RLS policies gate writes to
 * the reels buckets). The service role is never exposed to the browser.
 *
 * Supabase requires a fixed 6 MB chunk size for resumable uploads.
 */
const CHUNK_SIZE = 6 * 1024 * 1024;

export interface ResumableUploadParams {
  bucket: string;
  objectPath: string;
  file: File;
  accessToken: string;
  contentType?: string;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}

export function resumableUpload(params: ResumableUploadParams): Promise<void> {
  const base = normalizeSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!base) throw new Error('NEXT_PUBLIC_SUPABASE_URL manquant.');
  const endpoint = `${base}/storage/v1/upload/resumable`;

  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(params.file, {
      endpoint,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: {
        authorization: `Bearer ${params.accessToken}`,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: CHUNK_SIZE,
      metadata: {
        bucketName: params.bucket,
        objectName: params.objectPath,
        contentType: params.contentType || params.file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      onError: (error) => reject(error),
      onProgress: (sent, total) => {
        if (params.onProgress && total > 0) {
          params.onProgress(Math.round((sent / total) * 100));
        }
      },
      onSuccess: () => resolve(),
    });

    if (params.signal) {
      params.signal.addEventListener('abort', () => {
        void upload.abort(true).finally(() => reject(new DOMException('Aborted', 'AbortError')));
      });
    }

    upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });
}
