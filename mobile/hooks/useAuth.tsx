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
import { deactivatePushToken, registerPushToken } from '@/lib/push-notifications';
import { fetchClientIdentity, type ClientIdentity } from '@/hooks/useClientWorkspace';
import type { Employee } from '@/types/db';

const NO_ACCOUNT_MSG =
  'Compte connecté mais aucun accès trouvé. Contactez l’équipe Supra.';
const INACTIVE_MSG = 'Compte employé inactif. Contactez un administrateur.';
const CLIENT_MUST_CHANGE_MSG =
  'Définissez d’abord votre mot de passe depuis le lien reçu par e-mail.';
const MUST_CHANGE_MSG =
  'Vous devez d’abord définir votre mot de passe depuis l’application web.';

/** Staff = ligne employees active. Client = client_users actif (via RPC). */
export type AccountType = 'staff' | 'client';

interface AuthState {
  /** True until the persisted session + profile have been resolved. */
  initializing: boolean;
  session: Session | null;
  employee: Employee | null;
  clientUser: ClientIdentity | null;
  accountType: AccountType | null;
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

/**
 * Refus applicable à un profil STAFF existant (null = accès autorisé).
 * `null` employee ⇒ pas un refus : on tentera la piste client.
 */
function staffGateError(employee: Employee): string | null {
  if (!employee.is_active || employee.archived_at) return INACTIVE_MSG;
  if (employee.must_change_password) return MUST_CHANGE_MSG;
  return null;
}

type ResolvedAccount =
  | { type: 'staff'; employee: Employee }
  | { type: 'client'; client: ClientIdentity }
  | { type: 'rejected'; reason: string };

/**
 * Détermine le type de compte pour une session.
 *
 * Ordre volontaire : STAFF d'abord. Il reflète la règle serveur —
 * `auth_client_id()` renvoie null dès qu'une ligne `employees` existe, donc un
 * compte staff ne peut jamais résoudre comme client, même via les RPC.
 *
 * Le client est détecté par `portal_my_client()` et non par une lecture de
 * `client_users` : la policy SELECT de cette table est réservée admin/chef de
 * projet — un client ne peut pas lire sa propre ligne. La RPC est la seule
 * voie prévue, et elle filtre déjà les comptes inactifs (fail-closed).
 */
async function resolveAccount(userId: string): Promise<ResolvedAccount> {
  const employee = await fetchEmployee(userId);
  if (employee) {
    const gate = staffGateError(employee);
    return gate ? { type: 'rejected', reason: gate } : { type: 'staff', employee };
  }

  const client = await fetchClientIdentity();
  if (client) {
    if (client.must_change_password) {
      return { type: 'rejected', reason: CLIENT_MUST_CHANGE_MSG };
    }
    return { type: 'client', client };
  }

  // Ni staff, ni client actif : compte Auth orphelin ou désactivé.
  return { type: 'rejected', reason: NO_ACCOUNT_MSG };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [clientUser, setClientUser] = useState<ClientIdentity | null>(null);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const clearAccount = useCallback(() => {
    setEmployee(null);
    setClientUser(null);
    setAccountType(null);
  }, []);

  const loadProfileFor = useCallback(
    async (s: Session | null) => {
      if (!s?.user) {
        clearAccount();
        return;
      }
      try {
        const account = await resolveAccount(s.user.id);

        if (account.type === 'rejected') {
          // Session restaurée mais accès devenu invalide → déconnexion.
          await supabase.auth.signOut();
          clearAccount();
          return;
        }

        if (account.type === 'staff') {
          setEmployee(account.employee);
          setClientUser(null);
          setAccountType('staff');
          // Push : staff uniquement en Phase 1 (aucun push client prévu).
          void registerPushToken(s.user.id);
          return;
        }

        setEmployee(null);
        setClientUser(account.client);
        setAccountType('client');
      } catch {
        // Erreur réseau au restore : on garde la session, retry via refreshEmployee.
        clearAccount();
      }
    },
    [clearAccount],
  );

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
        clearAccount();
      } else if (newSession.user.id !== previousUserId) {
        void loadProfileFor(newSession);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfileFor, clearAccount]);

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
        const account = await resolveAccount(data.user.id);

        if (account.type === 'rejected') {
          await supabase.auth.signOut();
          clearAccount();
          return { error: account.reason };
        }

        if (account.type === 'staff') {
          setEmployee(account.employee);
          setClientUser(null);
          setAccountType('staff');
          void registerPushToken(data.user.id);
          return { error: null };
        }

        setEmployee(null);
        setClientUser(account.client);
        setAccountType('client');
        return { error: null };
      } catch (e) {
        logDevError('signIn:account', e);
        await supabase.auth.signOut();
        clearAccount();
        return { error: 'Impossible de vérifier votre accès. Réessayez plus tard.' };
      }
    },
    [clearAccount],
  );

  const signOut = useCallback(async () => {
    // Avant signOut : la RLS exige encore la session pour écrire le jeton.
    await deactivatePushToken();
    await supabase.auth.signOut();
    clearAccount();
  }, [clearAccount]);

  const refreshEmployee = useCallback(async () => {
    await loadProfileFor(sessionRef.current);
  }, [loadProfileFor]);

  return (
    <AuthContext.Provider
      value={{
        initializing,
        session,
        employee,
        clientUser,
        accountType,
        signIn,
        signOut,
        refreshEmployee,
      }}
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
