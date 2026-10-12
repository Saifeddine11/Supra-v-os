/**
 * Reels Studio — shared constants, labels and pure helpers (client-safe).
 */
import type {
  ClipStatus,
  SourceVideoStatus,
  StudioContentType,
  SubtitlePreset,
  SubtitleStyleConfig,
} from '@/types/studio';

export const STUDIO_SOURCE_BUCKET = 'reels-source';
export const STUDIO_MEDIA_BUCKET = 'reels-media';

// ─── Source video processing states ────────────────────────────────────────
export const SOURCE_STATUS_META: Record<
  SourceVideoStatus,
  { label: string; tone: 'muted' | 'info' | 'warn' | 'success' | 'danger'; terminal: boolean }
> = {
  uploading:         { label: 'Téléversement',     tone: 'info',    terminal: false },
  processing:        { label: 'Traitement',        tone: 'info',    terminal: false },
  generating_proxy:  { label: 'Génération proxy',   tone: 'info',    terminal: false },
  transcribing:      { label: 'Transcription',     tone: 'info',    terminal: false },
  analyzing:         { label: 'Analyse IA',        tone: 'info',    terminal: false },
  ready:             { label: 'Prête',             tone: 'success', terminal: true },
  failed:            { label: 'Échec',             tone: 'danger',  terminal: true },
};

export const SOURCE_STATUS_ORDER: SourceVideoStatus[] = [
  'uploading',
  'processing',
  'generating_proxy',
  'transcribing',
  'analyzing',
  'ready',
];

// ─── Clip / review workflow statuses ────────────────────────────────────────
export const CLIP_STATUS_META: Record<
  ClipStatus,
  { label: string; tone: 'muted' | 'info' | 'warn' | 'success' | 'danger' }
> = {
  to_process:        { label: 'À traiter',          tone: 'muted'   },
  editing:           { label: 'En édition',         tone: 'info'    },
  needs_review:      { label: 'À relire',           tone: 'warn'    },
  changes_requested: { label: 'Corrections demandées', tone: 'danger' },
  approved:          { label: 'Validé',             tone: 'success' },
  exported:          { label: 'Exporté',            tone: 'success' },
};

export const CONTENT_TYPE_META: Record<
  StudioContentType,
  { label: string; defaultMode: 'transcript' | 'visual' }
> = {
  podcast:       { label: 'Podcast',        defaultMode: 'transcript' },
  interview:     { label: 'Interview',      defaultMode: 'transcript' },
  talking_head:  { label: 'Face caméra',    defaultMode: 'transcript' },
  client_shoot:  { label: 'Tournage client', defaultMode: 'visual'    },
  event:         { label: 'Événement',      defaultMode: 'visual'     },
};

// ─── Subtitle presets ───────────────────────────────────────────────────────
export const SUBTITLE_PRESETS: Record<SubtitlePreset, { label: string; config: SubtitleStyleConfig }> = {
  clean_minimal: {
    label: 'Clean Minimal',
    config: {
      fontFamily: 'Inter',
      fontSize: 52,
      fontWeight: 600,
      color: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 2,
      backgroundColor: null,
      position: 'bottom',
      maxWidthPct: 86,
      lineHeight: 1.15,
      align: 'center',
      uppercase: false,
      activeWordHighlight: false,
    },
  },
  bold_social: {
    label: 'Bold Social',
    config: {
      fontFamily: 'Inter',
      fontSize: 64,
      fontWeight: 800,
      color: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 4,
      backgroundColor: null,
      position: 'center',
      maxWidthPct: 84,
      lineHeight: 1.1,
      align: 'center',
      uppercase: true,
      activeWordHighlight: false,
    },
  },
  word_highlight: {
    label: 'Word Highlight',
    config: {
      fontFamily: 'Inter',
      fontSize: 60,
      fontWeight: 800,
      color: '#FFFFFF',
      highlightColor: '#FF3D0A',
      outlineColor: '#000000',
      outlineWidth: 3,
      backgroundColor: null,
      position: 'center',
      maxWidthPct: 84,
      lineHeight: 1.12,
      align: 'center',
      uppercase: true,
      activeWordHighlight: true,
    },
  },
};

export function subtitlePresetConfig(preset: string): SubtitleStyleConfig {
  return (SUBTITLE_PRESETS[preset as SubtitlePreset] ?? SUBTITLE_PRESETS.clean_minimal).config;
}

// Output format (fixed for milestone 1)
export const EXPORT_WIDTH = 1080;
export const EXPORT_HEIGHT = 1920;
