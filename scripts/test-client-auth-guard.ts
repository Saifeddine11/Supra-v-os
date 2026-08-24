/**
 * Client auth guard — execution: npx tsx scripts/test-client-auth-guard.ts
 *
 * Covers the Phase 1B decision matrix. HTTP routes are not spun up here.
 */
import assert from 'node:assert/strict';
import { decideClientAccess } from '../src/lib/clients/access-decision';
import {
  CLIENT_AUTH_ERRORS,
  CLIENT_HOME_PATH,
  CLIENT_LOGIN_PATH,
  displayClientLoginError,
  isClientLoginPath,
  isClientProtectedPath,
  safeClientNextPath,
} from '../src/lib/clients/auth-errors';

function activeRow(overrides?: Partial<{ is_active: boolean; must_change_password: boolean; client_id: string }>) {
  return {
    is_active: true,
    must_change_password: false,
    client_id: 'client-1',
    ...overrides,
  };
}

function main() {
  const valid = decideClientAccess({
    hasAuthUser: true,
    clientUser: activeRow(),
    clientExists: true,
    isStaff: false,
  });
  assert.deepEqual(valid, { status: 'allow', mustChangePassword: false }, 'valid client can access /client');

  const mustChange = decideClientAccess({
    hasAuthUser: true,
    clientUser: activeRow({ must_change_password: true }),
    clientExists: true,
    isStaff: false,
  });
  assert.deepEqual(
    mustChange,
    { status: 'allow', mustChangePassword: true },
    'must_change_password still authenticates but flags setup',
  );

  const inactive = decideClientAccess({
    hasAuthUser: true,
    clientUser: activeRow({ is_active: false }),
    clientExists: true,
    isStaff: false,
  });
  assert.equal(inactive.status, 'inactive', 'inactive client cannot access /client');

  const orphan = decideClientAccess({
    hasAuthUser: true,
    clientUser: null,
    clientExists: false,
    isStaff: false,
  });
  assert.equal(orphan.status, 'missing', 'orphan Auth user cannot access /client');

  const staff = decideClientAccess({
    hasAuthUser: true,
    clientUser: null,
    clientExists: false,
    isStaff: true,
  });
  assert.equal(staff.status, 'staff', 'staff-only Auth user cannot access /client');

  const dualForbidden = decideClientAccess({
    hasAuthUser: true,
    clientUser: activeRow(),
    clientExists: true,
    isStaff: true,
  });
  assert.equal(dualForbidden.status, 'staff', 'staff wins if both identities existed');

  const missingClient = decideClientAccess({
    hasAuthUser: true,
    clientUser: activeRow(),
    clientExists: false,
    isStaff: false,
  });
  assert.equal(missingClient.status, 'missing', 'client_users without a client row is rejected');

  const unauthenticated = decideClientAccess({
    hasAuthUser: false,
    clientUser: null,
    clientExists: false,
    isStaff: false,
  });
  assert.equal(unauthenticated.status, 'unauthenticated', 'unauthenticated cannot access /client');

  assert.equal(isClientProtectedPath('/client'), true);
  assert.equal(isClientProtectedPath('/client/login'), false);
  assert.equal(isClientLoginPath('/client/login'), true);
  assert.equal(safeClientNextPath('/dashboard'), CLIENT_HOME_PATH);
  assert.equal(safeClientNextPath('/client/login'), CLIENT_HOME_PATH);
  assert.equal(safeClientNextPath('/client'), CLIENT_HOME_PATH);
  assert.equal(safeClientNextPath('https://evil.example'), CLIENT_HOME_PATH);
  assert.equal(safeClientNextPath('//evil.example'), CLIENT_HOME_PATH);
  assert.equal(safeClientNextPath('/client/../../login'), CLIENT_HOME_PATH);
  assert.equal(safeClientNextPath('/client/%2e%2e/%2e%2e/login'), CLIENT_HOME_PATH);
  assert.equal(CLIENT_LOGIN_PATH, '/client/login');

  assert.equal(displayClientLoginError({ status: 401 }), CLIENT_AUTH_ERRORS.invalidCredentials);
  assert.equal(displayClientLoginError({ status: 403, code: 'DISABLED' }), CLIENT_AUTH_ERRORS.inactive);
  assert.equal(displayClientLoginError({ status: 403, code: 'ACCESS' }), CLIENT_AUTH_ERRORS.genericAccess);
  assert.equal(displayClientLoginError({ status: 403, code: 'STAFF' }), CLIENT_AUTH_ERRORS.staff);
  assert.equal(
    displayClientLoginError({ status: 500, message: 'relation public.client_users does not exist' }),
    CLIENT_AUTH_ERRORS.unavailable,
  );

  console.log('OK — client auth guard');
}

main();
