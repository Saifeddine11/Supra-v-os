import { hasFullOrgDataAccess } from '@/lib/auth/data-scope';
import type { AuthContext } from '@/lib/auth/permissions';
import {
  parseAiDateRangeFromText,
  type ParsedAiDateRange,
} from '@/lib/dates/parse-ai-date-range';

export type CalendarEventFocus = 'all' | 'tasks' | 'shootings' | 'deliveries';

export type CalendarScopeMode = 'global' | 'personal';

export type DetectedCalendarIntent = {
  period: ParsedAiDateRange;
  scopeMode: CalendarScopeMode;
  eventFocus: CalendarEventFocus;
  globalWording: boolean;
};

const CALENDAR_TRIGGER =
  /\b(on a quoi|qu['']est-ce qu['']il y a|planning du|calendrier du|calendrier|planning|tournages?|livraisons?|échéances?|echeances?)\b/i;

const PERSONAL_WORDING =
  /\b(j['']ai quoi|mes?\s+(?:tâches?|taches?|vidéos?|videos?|tournages?|livraisons?|priorités?|priorites?|échéances?|echeances?)|mon\s+(?:planning|calendrier))\b/i;

const GLOBAL_WORDING = /\b(on a quoi|qu['']est-ce qu['']il y a|planning du|calendrier du|calendrier équipe|calendrier equipe|tout le calendrier)\b/i;

const DATE_HINT =
  /\b(aujourd['']hui|demain|cette semaine|semaine prochaine|ce mois-ci|ce mois|mois prochain|cette fin de semaine|le \d{1,2}|du \d{1,2}|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\b/i;

function detectEventFocus(text: string): CalendarEventFocus {
  const raw = text.toLowerCase();
  if (/\b(?:mes?\s+)?tournages?\b/.test(raw) && !/\blivraisons?\b/.test(raw)) {
    return 'shootings';
  }
  if (/\b(?:mes?\s+)?livraisons?\b/.test(raw) && !/\btournages?\b/.test(raw)) {
    return 'deliveries';
  }
  if (/\b(?:mes?\s+)?tâches?\b|\b(?:mes?\s+)?taches?\b/.test(raw) && !/\bvidéos?\b|\bvideos?\b/.test(raw)) {
    return 'tasks';
  }
  return 'all';
}

export function isCalendarScopeQuestion(text: string): boolean {
  const raw = text.trim();
  if (!raw) return false;

  if (PERSONAL_WORDING.test(raw) && DATE_HINT.test(raw)) return true;
  if (CALENDAR_TRIGGER.test(raw) && DATE_HINT.test(raw)) return true;
  if (/\b(on a quoi|j['']ai quoi)\b/i.test(raw) && DATE_HINT.test(raw)) return true;
  if (/\b(tournages?|livraisons?)\b/i.test(raw) && DATE_HINT.test(raw)) return true;
  if (/\b(on a quoi|j['']ai quoi)\s+(aujourd['']hui|demain|cette semaine|ce mois-ci)\b/i.test(raw)) {
    return true;
  }

  return false;
}

export function detectCalendarIntent(
  text: string,
  ctx: AuthContext,
): { ok: true; intent: DetectedCalendarIntent } | { ok: false; clarify?: string } {
  if (!isCalendarScopeQuestion(text)) {
    return { ok: false };
  }

  const parsed = parseAiDateRangeFromText(text);
  if (!parsed.ok) {
    if (parsed.ambiguous) {
      return { ok: false, clarify: parsed.message };
    }
    return { ok: false };
  }

  const personalWording = PERSONAL_WORDING.test(text);
  const globalWording = GLOBAL_WORDING.test(text) && !personalWording;
  const canGlobal = hasFullOrgDataAccess(ctx);

  let scopeMode: CalendarScopeMode = 'personal';
  if (canGlobal && globalWording) {
    scopeMode = 'global';
  } else if (canGlobal && !personalWording && CALENDAR_TRIGGER.test(text)) {
    scopeMode = 'global';
  }

  return {
    ok: true,
    intent: {
      period: parsed.range,
      scopeMode,
      eventFocus: detectEventFocus(text),
      globalWording: globalWording || scopeMode === 'global',
    },
  };
}

export function isExplicitGlobalCalendarRequest(text: string): boolean {
  return /\b(montre tout le calendrier|calendrier équipe|calendrier equipe|tout le calendrier|planning de l['']équipe|planning de l['']equipe|planning global)\b/i.test(
    text.trim(),
  );
}
