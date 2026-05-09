import type { ReportHighlight } from '@/types/database';

/** Fields allowed in generated report PDFs (no ids, metrics, WhatsApp, PDF paths, audit). */
export type ReportPdfContent = {
  title: string;
  period_start: string | null;
  period_end: string | null;
  summary: string | null;
  highlights: ReportHighlight[];
  next_actions: string | null;
  recommendations: string | null;
  visible_to_client: boolean;
};
