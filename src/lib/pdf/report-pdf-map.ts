import type { ReportHighlight } from '@/types/database';
import type { ReportPdfContent } from '@/lib/pdf/report-pdf-types';

/** Narrow DB row → PDF-safe payload (no metrics, WhatsApp, storage paths, ids). */
export function toReportPdfContent(row: {
  title: string;
  period_start: string | null;
  period_end: string | null;
  summary: string | null;
  highlights: unknown;
  next_actions: string | null;
  recommendations: string | null;
  visible_to_client: boolean;
}): ReportPdfContent {
  const highlights = Array.isArray(row.highlights) ? (row.highlights as ReportHighlight[]) : [];
  return {
    title: row.title,
    period_start: row.period_start,
    period_end: row.period_end,
    summary: row.summary,
    highlights,
    next_actions: row.next_actions,
    recommendations: row.recommendations,
    visible_to_client: row.visible_to_client,
  };
}
