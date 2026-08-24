/**
 * Client workspace ownership & finance helpers.
 * npx tsx scripts/test-client-workspace-scope.ts
 */
import assert from 'node:assert/strict';
import {
  assertOwnedByAuthenticatedClient,
  isClientResourceUuid,
  normalizeClientResourceUuid,
  resolveOwnedResourceId,
} from '../src/lib/clients/ownership';
import { invoicePaidAndRemaining } from '../src/lib/clients/workspace-finance';

function main() {
  const clientA = '11111111-1111-4111-8111-111111111111';
  const clientB = '22222222-2222-4222-8222-222222222222';
  const projectA = '33333333-3333-4333-8333-333333333333';
  const projectB = '44444444-4444-4444-8444-444444444444';

  assert.equal(isClientResourceUuid(clientA), true);
  assert.equal(isClientResourceUuid('not-a-uuid'), false);
  assert.equal(isClientResourceUuid(`${clientA}/../${clientB}`), false);
  assert.equal(normalizeClientResourceUuid(clientA.toUpperCase()), clientA);

  assert.equal(assertOwnedByAuthenticatedClient(clientA, clientA), 'ok');
  assert.equal(
    assertOwnedByAuthenticatedClient(clientB, clientA),
    'not_found',
    'Client A cannot own Client B resource',
  );
  assert.equal(assertOwnedByAuthenticatedClient(null, clientA), 'not_found');
  assert.equal(assertOwnedByAuthenticatedClient(undefined, clientA), 'not_found');
  assert.equal(assertOwnedByAuthenticatedClient(clientA, ''), 'not_found');

  const owned = resolveOwnedResourceId(projectA, clientA, clientA);
  assert.equal(owned.ok, true);
  if (owned.ok) assert.equal(owned.id, projectA);

  const foreign = resolveOwnedResourceId(projectB, clientB, clientA);
  assert.equal(foreign.ok, false);
  if (!foreign.ok) assert.equal(foreign.reason, 'not_found');

  const invalid = resolveOwnedResourceId('../../../etc/passwd', clientA, clientA);
  assert.equal(invalid.ok, false);

  const paid = invoicePaidAndRemaining(1200, 'paid', 0);
  assert.equal(paid.remaining, 0);
  assert.equal(paid.paidAmount, 1200);

  const partial = invoicePaidAndRemaining(1000, 'sent', 250);
  assert.equal(partial.paidAmount, 250);
  assert.equal(partial.remaining, 750);

  const overpay = invoicePaidAndRemaining(100, 'pending', 150);
  assert.equal(overpay.paidAmount, 100);
  assert.equal(overpay.remaining, 0);

  console.log('test-client-workspace-scope: ok');
}

main();
