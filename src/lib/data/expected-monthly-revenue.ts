import type { ClientStatus, ContractType } from '@/types/database';

export type ClientContractRow = {
  status: ClientStatus;
  contract_type: ContractType;
  monthly_fee: number | string | null;
  start_date: string | null;
  end_date: string | null;
};

/** Bornes inclusives du mois calendaire (dates ISO YYYY-MM-DD). */
export function calendarMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { start, end };
}

/**
 * CA prévu du mois à partir des fiches clients (sans facture).
 * - monthly / retainer : forfait `monthly_fee` chaque mois couvert par la période contrat.
 * - one_shot : `monthly_fee` une seule fois si `start_date` tombe dans le mois (obligatoire).
 */
export function expectedMonthlyRevenueFromClients(
  clients: ClientContractRow[],
  year: number,
  month: number
): number {
  const { start: monthStart, end: monthEnd } = calendarMonthRange(year, month);
  let sum = 0;

  for (const cl of clients) {
    if (cl.status !== 'active') continue;
    const fee = Number(cl.monthly_fee);
    if (!Number.isFinite(fee) || fee <= 0) continue;

    const sd = cl.start_date?.trim() || null;
    const ed = cl.end_date?.trim() || null;

    if (ed && ed < monthStart) continue;
    if (sd && sd > monthEnd) continue;

    if (cl.contract_type === 'one_shot') {
      if (sd && sd >= monthStart && sd <= monthEnd) {
        sum += fee;
      }
      continue;
    }

    // monthly + retainer : récurrent tant que la période chevauche le mois
    sum += fee;
  }

  return Math.round(sum * 100) / 100;
}
