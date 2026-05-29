import 'server-only';

import type { AiVideoDraftPayload } from '@/lib/ai/video-draft-schema';
import { extractStructuredVideoFields } from '@/lib/ai/normalize-video-draft';

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function cleanTitle(raw: string): string {
  return capitalizeFirst(
    raw
      .replace(/\s*[.!?]+\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160),
  );
}

/** Heuristic video draft when the model omits videoDraft. */
export function extractVideoDraftFromUserMessage(message: string): AiVideoDraftPayload | null {
  const text = message.trim();
  if (!text) return null;

  const structured = extractStructuredVideoFields(message);
  if (structured) return structured;

  let clientName: string | undefined;
  const forClient = text.match(
    /\b(?:pour|client)\s+([A-ZÀ-ÿ][\w\s.'-]{1,80}?)(?:\s*:|,|\s+titre|\s+tournage|\s+livraison)/i,
  );
  if (forClient?.[1]) {
    clientName = forClient[1].trim();
  }

  let title = '';
  const titleMatch = text.match(/\btitre\s+([^,]+?)(?:,|\s+livraison|\s+tournage|$)/i);
  if (titleMatch?.[1]) {
    title = cleanTitle(titleMatch[1]);
  } else {
    const colonIdx = text.indexOf(':');
    if (colonIdx >= 0) {
      const after = text.slice(colonIdx + 1);
      const stripped = after
        .replace(/\btitre\s+/i, '')
        .replace(/\blivraison\b.*/i, '')
        .replace(/\btournage\b.*/i, '')
        .trim();
      if (stripped) title = cleanTitle(stripped.split(',')[0] ?? stripped);
    }
  }

  if (!title) {
    title = 'Nouvelle vidéo';
  }

  const shootingMatch = text.match(/\btournage\s+([^,]+?)(?:,|\s+livraison|$)/i);
  const deliveryMatch = text.match(/\blivraison\s+([^,.]+)/i);

  return {
    title,
    clientName,
    shootingDateText: shootingMatch?.[1]?.trim(),
    clientDeliveryDateText: deliveryMatch?.[1]?.trim(),
    productionStatus: 'idea',
    portalStatus: 'topic_proposed',
    priority: 'normal',
  };
}

export { normalizeVideoDraft } from '@/lib/ai/normalize-video-draft';
