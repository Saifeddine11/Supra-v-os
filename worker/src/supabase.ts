import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';

// Service-role client — bypasses RLS. Worker only; never exposed to a browser.
export const supabase: SupabaseClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
