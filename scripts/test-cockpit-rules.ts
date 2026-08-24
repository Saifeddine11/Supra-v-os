/**
 * Règles cockpit admin — exécution : npx tsx scripts/test-cockpit-rules.ts
 */
import assert from 'node:assert/strict';
import {
  DEFAULT_ESTIMATED_TASK_HOURS,
  deriveWorkload,
  invoiceResidual,
  projectHealth,
} from '../src/lib/dashboard/cockpit-rules';
import {
  expectedMonthlyRevenueFromClients,
  type ClientContractRow,
} from '../src/lib/data/expected-monthly-revenue';

function contract(partial: Partial<ClientContractRow> & Pick<ClientContractRow, 'contract_type' | 'monthly_fee'>): ClientContractRow {
  return {
    status: 'active',
    start_date: '2026-01-01',
    end_date: null,
    ...partial,
  };
}

function main() {
  assert.equal(DEFAULT_ESTIMATED_TASK_HOURS, 4);

  assert.equal(deriveWorkload(0, 0, 0), 'available');
  assert.equal(deriveWorkload(2, 0, 39), 'available');
  assert.equal(deriveWorkload(3, 0, 0), 'normal');
  assert.equal(deriveWorkload(1, 0, 40), 'normal');
  assert.equal(deriveWorkload(7, 0, 0), 'busy');
  assert.equal(deriveWorkload(1, 1, 0), 'busy');
  assert.equal(deriveWorkload(1, 0, 75), 'busy');
  assert.equal(deriveWorkload(13, 0, 0), 'overloaded');
  assert.equal(deriveWorkload(1, 3, 0), 'overloaded');
  assert.equal(deriveWorkload(1, 0, 100), 'overloaded');

  assert.equal(invoiceResidual('paid', 1000, 0), 0);
  assert.equal(invoiceResidual('draft', 1000, 0), 0);
  assert.equal(invoiceResidual('cancelled', 1000, 0), 0);
  assert.equal(invoiceResidual('sent', 1000, 200), 800);
  assert.equal(invoiceResidual('overdue', 500, 0), 500);
  assert.equal(invoiceResidual('pending', 100, 150), 0);
  assert.equal(invoiceResidual('sent', Number.NaN, 0), 0);

  const now = new Date('2026-08-24T12:00:00');
  assert.equal(
    projectHealth({ status: 'validated', deadline: null, overdueTasks: 0, blockedTasks: 0, now }),
    'completed',
  );
  assert.equal(
    projectHealth({ status: 'in_progress', deadline: null, overdueTasks: 0, blockedTasks: 2, now }),
    'blocked',
  );
  assert.equal(
    projectHealth({ status: 'waiting_content', deadline: null, overdueTasks: 0, blockedTasks: 0, now }),
    'blocked',
  );
  assert.equal(
    projectHealth({ status: 'in_progress', deadline: '2026-08-01', overdueTasks: 0, blockedTasks: 0, now }),
    'late',
  );
  assert.equal(
    projectHealth({ status: 'waiting_client', deadline: '2026-09-30', overdueTasks: 0, blockedTasks: 0, now }),
    'attention',
  );
  assert.equal(
    projectHealth({ status: 'in_progress', deadline: '2026-08-28', overdueTasks: 0, blockedTasks: 0, now }),
    'attention',
  );
  assert.equal(
    projectHealth({ status: 'in_progress', deadline: '2026-10-01', overdueTasks: 0, blockedTasks: 0, now }),
    'on_track',
  );

  assert.equal(
    expectedMonthlyRevenueFromClients([contract({ contract_type: 'monthly', monthly_fee: 1000 })], 2026, 8),
    1000,
  );
  assert.equal(
    expectedMonthlyRevenueFromClients(
      [contract({ contract_type: 'one_shot', monthly_fee: 2500, start_date: '2026-08-10' })],
      2026,
      8,
    ),
    2500,
  );
  assert.equal(
    expectedMonthlyRevenueFromClients(
      [contract({ contract_type: 'one_shot', monthly_fee: 2500, start_date: '2026-07-10' })],
      2026,
      8,
    ),
    0,
  );
  assert.equal(
    expectedMonthlyRevenueFromClients(
      [contract({ status: 'terminated', contract_type: 'monthly', monthly_fee: 1000 })],
      2026,
      8,
    ),
    0,
  );
  assert.equal(
    expectedMonthlyRevenueFromClients(
      [contract({ contract_type: 'retainer', monthly_fee: 800, start_date: '2026-01-01', end_date: '2026-12-31' })],
      2026,
      8,
    ),
    800,
  );

  console.log('test-cockpit-rules: ok');
}

main();
