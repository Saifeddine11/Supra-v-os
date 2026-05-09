/**
 * Supabase Storage bucket ids (private buckets; use signed URLs for download).
 * Create buckets via migration or Supabase dashboard — see supabase/migrations.
 */

export const STORAGE_BUCKETS = {
  documents: 'documents',
  deliverables: 'deliverables',
  reports: 'reports',
  quotes: 'quotes',
  invoices: 'invoices',
} as const;

/** Uploads and signed URLs require the service role on the server. */
export function isSupabaseStorageUploadConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(url && key);
}
