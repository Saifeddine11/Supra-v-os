import 'server-only';

import { randomBytes } from 'crypto';
import { createAdminClient, type ServiceRoleClient } from '@/lib/supabase/admin';
import { mapSupabaseAuthEmailError } from '@/lib/employees/auth-email-errors';
import {
  findAuthUserIdByEmail,
  getAuthSetPasswordRedirectUrl,
  getPublicLoginPageUrl,
} from '@/lib/employees/auth-provision';
import type { ClientUser } from '@/types/database';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHASE0_MISSING =
  'La table client_users n’existe pas encore. Appliquez d’abord la migration Phase 0 (fondation accès client).';

export class ClientUsersTableMissingError extends Error {
  constructor() {
    super(PHASE0_MISSING);
    this.name = 'ClientUsersTableMissingError';
  }
}

export function isMissingClientUsersTable(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /relation ["']?public\.client_users["']? does not exist/i.test(msg) ||
    /Could not find the table ['"]public\.client_users['"]/i.test(msg)
  );
}

function throwIfMissingTable(error: { code?: string; message?: string } | null): void {
  if (isMissingClientUsersTable(error)) throw new ClientUsersTableMissingError();
}

export function normalizeClientAccessEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidClientAccessEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeClientAccessEmail(email));
}

export function defaultClientFullName(email: string, fullName?: string | null): string {
  const trimmed = fullName?.trim();
  if (trimmed) return trimmed;
  const local = normalizeClientAccessEmail(email).split('@')[0] ?? 'Client';
  return local.replace(/[._-]+/g, ' ').trim() || 'Client';
}

function generateTemporaryPassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%*?-';
  const all = letters + numbers + symbols;
  const bytes = randomBytes(24);
  const chars: string[] = [
    letters[bytes[0]! % letters.length]!,
    letters[bytes[1]! % letters.length]!,
    numbers[bytes[2]! % numbers.length]!,
    symbols[bytes[3]! % symbols.length]!,
  ];
  for (let i = 4; i < 16; i += 1) {
    chars.push(all[bytes[i]! % all.length]!);
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = bytes[i]! % (i + 1);
    const current = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = current;
  }
  return chars.join('');
}

async function findEmployeeByEmail(admin: ServiceRoleClient, email: string) {
  const { data, error } = await admin
    .from('employees')
    .select('id, user_id, email, full_name')
    .ilike('email', email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function findEmployeeByUserId(admin: ServiceRoleClient, userId: string) {
  const { data, error } = await admin
    .from('employees')
    .select('id, user_id, email, full_name')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function findClientUserByEmail(
  admin: ServiceRoleClient,
  email: string,
): Promise<ClientUser | null> {
  const { data, error } = await admin
    .from('client_users')
    .select('*')
    .ilike('email', email)
    .maybeSingle();
  if (error) {
    throwIfMissingTable(error);
    throw new Error(error.message);
  }
  return (data as ClientUser | null) ?? null;
}

async function findClientUserByUserId(
  admin: ServiceRoleClient,
  userId: string,
): Promise<ClientUser | null> {
  const { data, error } = await admin
    .from('client_users')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throwIfMissingTable(error);
    throw new Error(error.message);
  }
  return (data as ClientUser | null) ?? null;
}

export async function assertClientExists(clientId: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('clients').select('id').eq('id', clientId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Client introuvable.');
}

export async function listClientUsersForClient(clientId: string): Promise<ClientUser[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('client_users')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) {
    throwIfMissingTable(error);
    throw new Error(error.message);
  }
  return (data as ClientUser[]) ?? [];
}

async function insertClientUserRow(
  admin: ServiceRoleClient,
  input: {
    authUserId: string;
    clientId: string;
    fullName: string;
    email: string;
    createdByUserId: string;
  },
): Promise<ClientUser> {
  const staff = await findEmployeeByUserId(admin, input.authUserId);
  if (staff) {
    throw new Error('Ce compte Auth est déjà un employé interne.');
  }

  const { data: row, error } = await admin
    .from('client_users')
    .insert({
      user_id: input.authUserId,
      client_id: input.clientId,
      full_name: input.fullName,
      email: input.email,
      is_active: true,
      must_change_password: true,
      created_by: input.createdByUserId,
    })
    .select('*')
    .single();

  if (error || !row) {
    throwIfMissingTable(error);
    throw new Error(error?.message ?? 'Impossible d’enregistrer l’accès client.');
  }

  return row as ClientUser;
}

export type ProvisionClientUserAccessResult = {
  clientUser: ClientUser;
  authUserId: string;
  invited: boolean;
  temporaryPassword: string | null;
};

export async function provisionClientUserAccess(input: {
  clientId: string;
  fullName: string;
  email: string;
  createdByUserId: string;
  passwordMode: 'invite' | 'temporary';
}): Promise<ProvisionClientUserAccessResult> {
  const email = normalizeClientAccessEmail(input.email);
  if (!isValidClientAccessEmail(email)) {
    throw new Error('Adresse e-mail invalide.');
  }

  await assertClientExists(input.clientId);
  const admin = createAdminClient();

  const employee = await findEmployeeByEmail(admin, email);
  if (employee) {
    throw new Error(
      'Cet e-mail appartient à un employé interne. Les accès client et staff sont séparés.',
    );
  }

  const existingByEmail = await findClientUserByEmail(admin, email);
  if (existingByEmail) {
    if (existingByEmail.client_id === input.clientId) {
      throw new Error('Un accès client existe déjà pour cet e-mail sur ce client.');
    }
    throw new Error('Cet e-mail est déjà lié à un autre client.');
  }

  const existingAuthId = await findAuthUserIdByEmail(admin, email);
  if (existingAuthId) {
    const staffByUser = await findEmployeeByUserId(admin, existingAuthId);
    if (staffByUser) {
      throw new Error('Ce compte Auth est déjà un employé interne.');
    }
    const otherClient = await findClientUserByUserId(admin, existingAuthId);
    if (otherClient) {
      if (otherClient.client_id === input.clientId) {
        throw new Error('Un accès client existe déjà pour ce compte sur ce client.');
      }
      throw new Error('Ce compte Auth est déjà lié à un autre client.');
    }
    throw new Error(
      'Un compte Auth existe déjà pour cet e-mail, sans fiche client. Contactez un administrateur.',
    );
  }

  const fullName = defaultClientFullName(email, input.fullName);
  let authUserId: string | null = null;
  let invited = false;
  let temporaryPassword: string | null = null;

  try {
    if (input.passwordMode === 'invite') {
      const { data: invitedUser, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: getAuthSetPasswordRedirectUrl(),
        data: {
          full_name: fullName,
          account_type: 'client',
        },
      });
      if (inviteErr || !invitedUser?.user?.id) {
        throw new Error(
          mapSupabaseAuthEmailError(inviteErr?.message ?? '') || 'Impossible d’envoyer l’invitation.',
        );
      }
      authUserId = invitedUser.user.id;
      invited = true;
      const { error: metaErr } = await admin.auth.admin.updateUserById(authUserId, {
        app_metadata: {
          account_type: 'client',
          client_id: input.clientId,
        },
      });
      if (metaErr) {
        throw new Error(metaErr.message);
      }
    } else {
      temporaryPassword = generateTemporaryPassword();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          account_type: 'client',
        },
        app_metadata: {
          account_type: 'client',
          client_id: input.clientId,
        },
      });
      if (error || !data.user) {
        throw new Error(
          mapSupabaseAuthEmailError(error?.message ?? '') ||
            'Création du compte Auth client impossible.',
        );
      }
      authUserId = data.user.id;
    }

    const clientUser = await insertClientUserRow(admin, {
      authUserId,
      clientId: input.clientId,
      fullName,
      email,
      createdByUserId: input.createdByUserId,
    });

    return {
      clientUser,
      authUserId,
      invited,
      temporaryPassword,
    };
  } catch (e) {
    if (authUserId) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    }
    throw e;
  }
}

export async function getClientUserOrThrow(clientUserId: string): Promise<ClientUser> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('client_users')
    .select('*')
    .eq('id', clientUserId)
    .maybeSingle();
  if (error) {
    throwIfMissingTable(error);
    throw new Error(error.message);
  }
  if (!data) throw new Error('Accès client introuvable.');
  return data as ClientUser;
}

export async function setClientUserActiveStatus(
  clientUserId: string,
  isActive: boolean,
): Promise<ClientUser> {
  await getClientUserOrThrow(clientUserId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('client_users')
    .update({ is_active: isActive })
    .eq('id', clientUserId)
    .select('*')
    .single();
  if (error || !data) {
    throwIfMissingTable(error);
    throw new Error(error?.message ?? 'Mise à jour impossible.');
  }
  return data as ClientUser;
}

export async function markClientUserMustChangePassword(clientUserId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('client_users')
    .update({ must_change_password: true })
    .eq('id', clientUserId);
  if (error) {
    throwIfMissingTable(error);
    throw new Error(error.message);
  }
}

export function clientLoginHint(): string {
  return getPublicLoginPageUrl();
}
