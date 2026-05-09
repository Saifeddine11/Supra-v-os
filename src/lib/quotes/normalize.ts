import type { QuoteDiscountMode, QuoteItem, QuoteStrategicBlock } from '@/types/database';

export function normalizeStrategicBlocks(raw: unknown): QuoteStrategicBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: QuoteStrategicBlock[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const title = String(o.title ?? '').trim();
    const body = String(o.body ?? '').trim();
    if (!title && !body) continue;
    out.push({ title: title || '—', body });
  }
  return out;
}

export function normalizeDiscountMode(raw: unknown): QuoteDiscountMode {
  return raw === 'percent' ? 'percent' : 'fixed';
}

export function normalizeQuoteItemRow(row: QuoteItem): QuoteItem {
  const desc = String(row.description ?? '');
  const sn = String(row.service_name ?? '').trim();
  return {
    ...row,
    service_name: sn || desc,
    detail_text: row.detail_text ?? null,
    strategic_explanation: row.strategic_explanation ?? null,
    is_optional: row.is_optional === true,
    is_recommended: row.is_recommended === true,
  };
}
