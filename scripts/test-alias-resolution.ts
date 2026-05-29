/**
 * Manual alias resolution checks (run: npx tsx scripts/test-alias-resolution.ts)
 */
import { resolveEmployeeAlias } from '../src/lib/ai/employee-aliases';
import { resolveClientAlias } from '../src/lib/ai/client-aliases';

const employees = [
  { id: 'e1', full_name: 'Julien' },
  { id: 'e2', full_name: 'Mounir Boutayeb' },
  { id: 'e3', full_name: 'Meryem Halli' },
  { id: 'e4', full_name: 'Cleis Padou' },
  { id: 'e5', full_name: 'Saif Eddine' },
];

const clients = [
  { id: 'c1', name: 'Shah Immobilier' },
  { id: 'c2', name: 'Emara Estates' },
  { id: 'c3', name: 'Africa Beauty' },
  { id: 'c4', name: 'Cassi' },
  { id: 'c5', name: 'Sculpt Body' },
];

type Case = { input: string; expect: 'resolved' | 'ambiguous' | 'not_found'; label?: string };

const employeeCases: Case[] = [
  { input: 'jul', expect: 'resolved', label: 'Julien' },
  { input: 'julien', expect: 'resolved', label: 'Julien' },
  { input: 'mymy', expect: 'resolved', label: 'Meryem Halli' },
  { input: 'mounir', expect: 'resolved', label: 'Mounir Boutayeb' },
  { input: 'm', expect: 'ambiguous' },
  { input: 'xyz', expect: 'not_found' },
];

const clientCases: Case[] = [
  { input: 'shah', expect: 'resolved', label: 'Shah Immobilier' },
  { input: 'emara', expect: 'resolved', label: 'Emara Estates' },
  { input: 'sbr', expect: 'resolved', label: 'Sculpt Body' },
];

let failed = 0;

function assertCase(kind: string, input: string, result: ReturnType<typeof resolveEmployeeAlias>, c: Case) {
  if (result.status !== c.expect) {
    console.error(`FAIL [${kind}] "${input}": expected ${c.expect}, got ${result.status}`);
    failed += 1;
    return;
  }
  if (c.expect === 'resolved' && result.status === 'resolved' && result.label !== c.label) {
    console.error(`FAIL [${kind}] "${input}": expected label ${c.label}, got ${result.label}`);
    failed += 1;
    return;
  }
  console.log(`OK [${kind}] "${input}" → ${result.status}${result.status === 'resolved' ? ` (${result.label})` : ''}`);
}

for (const c of employeeCases) {
  assertCase('employee', c.input, resolveEmployeeAlias(c.input, employees), c);
}

for (const c of clientCases) {
  assertCase('client', c.input, resolveClientAlias(c.input, clients), c);
}

if (failed > 0) {
  process.exit(1);
}

console.log('\nAll alias resolution checks passed.');
