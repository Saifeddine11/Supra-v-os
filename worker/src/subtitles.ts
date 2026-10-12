/**
 * Build an ASS subtitle file from clip subtitle cues + style config.
 * Times are relative to the assembled clip timeline (seconds from 0).
 */

export interface CueWord {
  text: string;
  start_ms: number;
  end_ms: number;
}

export interface Cue {
  start_ms: number;
  end_ms: number;
  text: string;
  words?: CueWord[];
}

export interface AssStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  highlightColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  position?: 'top' | 'center' | 'bottom';
  align?: 'left' | 'center' | 'right';
  uppercase?: boolean;
  activeWordHighlight?: boolean;
}

const W = 1080;
const H = 1920;

function hexToAss(hex: string | undefined, fallback = '&H00FFFFFF'): string {
  if (!hex) return fallback;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return fallback;
  const r = m[1].slice(0, 2);
  const g = m[1].slice(2, 4);
  const b = m[1].slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

function assTime(ms: number): string {
  const total = Math.max(0, ms);
  const cs = Math.floor((total % 1000) / 10);
  const s = Math.floor(total / 1000) % 60;
  const m = Math.floor(total / 60000) % 60;
  const h = Math.floor(total / 3600000);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${h}:${p2(m)}:${p2(s)}.${p2(cs)}`;
}

function alignmentCode(style: AssStyle): number {
  const col = style.align === 'left' ? 1 : style.align === 'right' ? 3 : 2;
  // numpad: bottom 1-3, middle 4-6, top 7-9
  if (style.position === 'top') return 6 + col;
  if (style.position === 'center') return 3 + col;
  return col; // bottom
}

export function buildAss(cues: Cue[], style: AssStyle): string {
  const fontName = style.fontFamily || 'Inter';
  const fontSize = style.fontSize ?? 52;
  const bold = (style.fontWeight ?? 600) >= 700 ? -1 : 0;
  const primary = style.activeWordHighlight
    ? hexToAss(style.highlightColor, '&H000A3DFF')
    : hexToAss(style.color, '&H00FFFFFF');
  const secondary = hexToAss(style.color, '&H00FFFFFF');
  const outline = hexToAss(style.outlineColor, '&H00000000');
  const outlineW = style.outlineWidth ?? 2;
  const align = alignmentCode(style);
  const marginV = style.position === 'bottom' ? Math.round(H * 0.12) : style.position === 'top' ? Math.round(H * 0.08) : 0;

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${fontName},${fontSize},${primary},${secondary},${outline},&H64000000,${bold},0,0,0,100,100,0,0,1,${outlineW},1,${align},80,80,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n');

  const lines = cues.map((cue) => {
    const txt = buildCueText(cue, style);
    return `Dialogue: 0,${assTime(cue.start_ms)},${assTime(cue.end_ms)},Default,,0,0,0,,${txt}`;
  });

  return `${header}\n${lines.join('\n')}\n`;
}

function buildCueText(cue: Cue, style: AssStyle): string {
  const transform = (s: string) => (style.uppercase ? s.toUpperCase() : s);

  if (style.activeWordHighlight && cue.words && cue.words.length > 0) {
    // Karaoke: progressive highlight using \k (centiseconds per word)
    return cue.words
      .map((w) => {
        const durCs = Math.max(1, Math.round((w.end_ms - w.start_ms) / 10));
        return `{\\k${durCs}}${transform(w.text)} `;
      })
      .join('')
      .trim();
  }
  return transform(cue.text).replace(/\n/g, '\\N');
}
