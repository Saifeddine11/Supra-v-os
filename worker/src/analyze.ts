import { config } from './config.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface AnalyzeSegment {
  start_ms: number;
  end_ms: number;
  text: string;
}

export interface Suggestion {
  title: string;
  start_ms: number;
  end_ms: number;
  hook: string;
  main_idea: string;
  ending: string;
  virality_score: number;
  confidence_score: number;
  reason: string;
}

const SYSTEM_PROMPT = `Tu es un monteur éditorial expert en contenu court vertical (Reels, TikTok, Shorts) pour une agence vidéo.
On te donne la transcription horodatée d'une vidéo longue (podcast, interview ou face caméra) en français.
Ta mission : proposer les meilleurs extraits à transformer en Reels.

Règles impératives pour chaque extrait :
- Commence par une accroche forte (déclaration, question, affirmation marquante).
- Contient UNE idée autonome compréhensible sans contexte manquant.
- Ne commence ni ne se termine au milieu d'une phrase.
- Contient de l'information, de l'émotion, une opinion, une tension, un insight ou du storytelling.
- Durée réaliste pour du court-format : entre 15 et 90 secondes.
- Peut fonctionner seul comme contenu court.

Tu NE publies rien. Tu proposes des recommandations éditoriales. Réponds UNIQUEMENT en JSON valide.`;

export async function analyzeTranscript(
  segments: AnalyzeSegment[],
  maxSuggestions = 6,
): Promise<Suggestion[]> {
  if (!config.openRouterApiKey) {
    throw new Error('OPENROUTER_API_KEY manquant — analyse IA impossible.');
  }
  if (segments.length === 0) return [];

  const transcript = segments
    .map((s) => `[${fmt(s.start_ms)} → ${fmt(s.end_ms)}] ${s.text}`)
    .join('\n');

  const userPrompt = `Transcription (horodatage mm:ss) :
${truncate(transcript, 24000)}

Propose jusqu'à ${maxSuggestions} extraits. Réponds en JSON strict :
{"suggestions":[{"title":"...","start":"mm:ss","end":"mm:ss","hook":"...","main_idea":"...","ending":"...","virality_score":0-100,"confidence_score":0-100,"reason":"..."}]}
- start/end au format mm:ss (ou hh:mm:ss) alignés sur la transcription.
- title court et accrocheur en français.
- reason : pourquoi ce segment a été choisi (1 phrase).`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app.suprav3.com',
        'X-Title': 'Supra V3 Reels Studio',
      },
      body: JSON.stringify({
        model: config.aiModel,
        temperature: 0.5,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('OpenRouter timeout (120s) — analyse IA interrompue.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? '';
  return parseSuggestions(content, segments);
}

function parseSuggestions(content: string, segments: AnalyzeSegment[]): Suggestion[] {
  const json = extractJson(content);
  if (!json) return [];
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  const rawList = Array.isArray(data)
    ? data
    : (data as { suggestions?: unknown[] })?.suggestions ?? [];
  if (!Array.isArray(rawList)) return [];

  const maxMs = segments[segments.length - 1]?.end_ms ?? 0;
  const out: Suggestion[] = [];
  for (const raw of rawList) {
    const r = raw as Record<string, unknown>;
    const startMs = toMs(r.start);
    const endMs = toMs(r.end);
    if (startMs == null || endMs == null || endMs <= startMs) continue;
    out.push({
      title: str(r.title, 'Extrait'),
      start_ms: clamp(startMs, 0, maxMs),
      end_ms: clamp(endMs, 0, maxMs),
      hook: str(r.hook, ''),
      main_idea: str(r.main_idea, ''),
      ending: str(r.ending, ''),
      virality_score: num(r.virality_score),
      confidence_score: num(r.confidence_score),
      reason: str(r.reason, ''),
    });
  }
  return out;
}

function extractJson(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const arrStart = candidate.indexOf('[');
  const first = start === -1 ? arrStart : arrStart === -1 ? start : Math.min(start, arrStart);
  if (first === -1) return null;
  const lastObj = candidate.lastIndexOf('}');
  const lastArr = candidate.lastIndexOf(']');
  const last = Math.max(lastObj, lastArr);
  if (last === -1) return null;
  return candidate.slice(first, last + 1);
}

function toMs(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 1000);
  if (typeof v !== 'string') return null;
  const s = v.trim();
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(s);
  if (m) {
    const h = m[1] ? Number(m[1]) : 0;
    const min = Number(m[2]);
    const sec = Number(m[3]);
    const frac = m[4] ? Number((m[4] + '000').slice(0, 3)) : 0;
    return (h * 3600 + min * 60 + sec) * 1000 + frac;
  }
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 1000) : null;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}
function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '\n[...]' : s;
}
function fmt(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
