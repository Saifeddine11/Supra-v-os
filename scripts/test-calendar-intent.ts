/**
 * Unit checks for SupAI calendar date parsing (no DB).
 * Run: npx tsx scripts/test-calendar-intent.ts
 */
import { parseAiDateRangeFromText, parisCalendarNow } from '../src/lib/dates/parse-ai-date-range';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const now = new Date('2026-05-29T10:00:00+02:00');

console.log('--- parseAiDateRangeFromText ---');
const day29 = parseAiDateRangeFromText('On a quoi le 29 ?', now);
assert(day29.ok === true, 'le 29 should parse');
if (day29.ok) {
  assert(day29.range.start.getDate() === 29, 'day should be 29');
  assert(day29.range.start.getMonth() === 4, 'month should be May (0-indexed 4)');
}

const week = parseAiDateRangeFromText('On a quoi cette semaine ?', now);
assert(week.ok === true, 'cette semaine should parse');

const month = parseAiDateRangeFromText('On a quoi ce mois-ci ?', now);
assert(month.ok === true, 'ce mois-ci should parse');

const tomorrow = parseAiDateRangeFromText("J'ai quoi demain ?", now);
assert(tomorrow.ok === true, 'demain should parse');

const dayMonth = parseAiDateRangeFromText('On a quoi le 31 mai ?', now);
assert(dayMonth.ok === true, 'le 31 mai should parse');
if (dayMonth.ok) {
  assert(dayMonth.range.start.getDate() === 31, 'day should be 31');
  assert(dayMonth.range.start.getMonth() === 4, 'month should be May');
}

console.log('--- paris now ---');
const paris = parisCalendarNow(now);
assert(paris.getFullYear() === 2026, 'paris year');

console.log('\nAll calendar date parsing tests passed.');
