/**
 * Supabase client for mobile — PUBLIC anon key only, RLS enforced.
 * Session is persisted in Expo SecureStore (see secure-session-store.ts).
 * Never import server secrets here (service role, Resend, OpenRouter, SMTP).
 */
import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { secureSessionStore } from '@/lib/secure-session-store';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigError: string | null =
  !url || !anonKey
    ? 'Configuration manquante : renseignez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY dans mobile/.env puis relancez expo start.'
    : null;

export const supabase = createClient(url ?? 'https://placeholder.supabase.co', anonKey ?? 'placeholder', {
  auth: {
    storage: secureSessionStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh the session while the app is foregrounded (official Expo pattern).
// Sous try/catch : ce code s'exécute à l'import, donc AVANT le premier rendu.
// Une exception ici ferait échouer l'évaluation du bundle, ce qu'expo-updates
// transforme en abort natif (SIGABRT) plutôt qu'en erreur affichable.
try {
  AppState.addEventListener('change', (state) => {
    try {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    } catch {
      // Rafraîchissement auto indisponible : la session reste utilisable.
    }
  });
} catch {
  // Pas d'AppState (contexte non-RN) : sans effet sur le reste de l'app.
}
