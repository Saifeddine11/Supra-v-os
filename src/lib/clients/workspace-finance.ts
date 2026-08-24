import type { InvoiceStatus } from '@/types/database';

export function roundClientMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function invoicePaidAndRemaining(total: number, status: InvoiceStatus, paymentsSum: number) {
  if (status === 'paid') {
    return { paidAmount: roundClientMoney(total), remaining: 0 };
  }
  const paidAmount = roundClientMoney(Math.min(total, Math.max(0, paymentsSum)));
  return { paidAmount, remaining: roundClientMoney(Math.max(0, total - paidAmount)) };
}
