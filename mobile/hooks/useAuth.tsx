/**
 * Auth context: Supabase session + employee profile.
 *
 * Mirrors the web login gates (src/app/api/auth/login/route.ts +
 * src/lib/auth/data-scope.ts):
 *  - no employee row      → refuse ("aucun profil employé")
 *  - inactive / archived  → refuse ("compte inactif")
 *  - must_change_password → refuse on mobile (password change happens on web)
 * These are UX gates; RLS on the server remains the real enforcement.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigError } from '@/lib/supabase';
import { logDevError, toUserMessage } from '@/lib/errors';
import type { Employee } from '@/types/db';

const NO_EMPLOYEE_MSG = 'Compte connecté mais aucun profil employé trouvé.';
const INACTIVE_MSG = 'Compte employé inactif. Contactez un administrateur.';
const MUST_CHANGE_MSG =
  'Vous devez d’abord définir votre mot de passe depuis l’application web.';

interface AuthState {
  /** True until the persisted session + profile have been resolved. */
  initializing: boolean;
  session: Session | null;
  employee: Employee | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshEmployee: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const EMPLOYEE_COLUMNS =
  'id, user_id, full_name, role, email, avatar_url, avatar_initials, avatar_color, is_active, archived_at, must_change_password';

async function fetchEmployee(userId: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .select(EMPLOYEE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Employee | null) ?? null;
}

/** Returns a refusal message when the profile is not allowed to use mobile. */
function employeeGateError(employee: Employee | null): string | null {
  if (!employee) return NO_EMPLOYEE_MSG;
  if (!employee.is_active || employee.archived_at) return INACTIVE_MSG;
  if (employee.must_change_password) return MUST_CHANGE_MSG;
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const loadProfileFor = useCallback(async (s: Session | null) => {
    if (!s?.user) {
      setEmployee(null);
      return;
    }
    try {
      const emp = await fetchEmployee(s.user.id);
      if (employeeGateError(emp)) {
        // Session restored but profile no longer valid → sign out.
        await supabase.auth.signOut();
        setEmployee(null);
        return;
      }
      setEmployee(emp);
    } catch {
      // Network/profile error on restore: keep the session, retry via refreshEmployee.
      setEmployee(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        sessionRef.current = data.session;
        setSession(data.session);
        await loadProfileFor(data.session);
      })
      .finally(() => {
        if (mounted) setInitializing(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const previousUserId = sessionRef.current?.user?.id;
      sessionRef.current = newSession;
      setSession(newSession);
      if (!newSession) {
        setEmployee(null);
      } else if (newSession.user.id !== previousUserId) {
        void loadProfileFor(newSession);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfileFor]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      if (supabaseConfigError) return { error: supabaseConfigError };

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        logDevError('signIn', error);
        if (/invalid login credentials/i.test(error.message)) {
          return { error: 'E-mail ou mot de passe incorrect.' };
        }
        if (/email not confirmed/i.test(error.message)) {
          return { error: 'Veuillez confirmer votre adresse e-mail avant de vous connecter.' };
        }
        return { error: toUserMessage(error, 'Connexion impossible. Réessayez.') };
      }

      try {
        const emp = await fetchEmployee(data.user.id);
        const gate = employeeGateError(emp);
        if (gate) {
          await supabase.auth.signOut();
          return { error: gate };
        }
        setEmployee(emp);
        return { error: null };
      } catch (e) {
        logDevError('signIn:employee', e);
        await supabase.auth.signOut();
        return { error: 'Impossible de vérifier le profil employé. Réessayez plus tard.' };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setEmployee(null);
  }, []);

  const refreshEmployee = useCallback(async () => {
    await loadProfileFor(sessionRef.current);
  }, [loadProfileFor]);

  return (
    <AuthContext.Provider
      value={{ initializing, session, employee, signIn, signOut, refreshEmployee }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
