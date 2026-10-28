import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyTotals } from '../src/monthlyTotals.ts';

test('groups cents by calendar month, payer and year, including empty months', () => {
  const movements = [
    { amountCents: 1234, expenseDate: '2026-01-31', payerId: '1' },
    { amountCents: 66, expenseDate: '2026-01-01', payerId: '1' },
    { amountCents: 500, expenseDate: '2026-02-01', payerId: '2' },
    { amountCents: 900, expenseDate: '2025-01-01', payerId: '1' },
    { amountCents: 10000, expenseDate: '2026-01-01', payerId: '1', kind: 'income' },
    { amountCents: 300, expenseDate: '2026-12-31', payerId: '1' },
  ];
  const all = monthlyTotals(movements, 2026);
  assert.equal(all.length, 12);
  assert.deepEqual(all[0], { expenses: 1300, income: 10000 });
  assert.equal(all[1].expenses, 500);
  assert.equal(all[11].expenses, 300);
  assert.deepEqual(all[2], { expenses: 0, income: 0 });
  assert.equal(monthlyTotals(movements, 2026, '1')[1].expenses, 0);
  assert.equal(monthlyTotals(movements, 2025)[0].expenses, 900);
  assert.equal(monthlyTotals([], 2026).every(m => m.expenses === 0 && m.income === 0), true);
});
