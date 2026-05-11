import type { VideoWithClient } from '@/lib/data/videos';

type AssigneeRow = Pick<VideoWithClient, 'editors' | 'cameramen' | 'editor_name' | 'cameraman_name'>;

/** Au moins une personne apparaît comme monteur et comme cadreur. */
export function samePersonVideoEditorAndCameraman(v: AssigneeRow): boolean {
  const ed = new Set(v.editors.map((x) => x.id));
  return v.cameramen.some((c) => ed.has(c.id));
}

/** Colonne « Monteur » dans les tableaux. */
export function videoMonteurTableCell(v: AssigneeRow): string {
  if (v.editors.length === 0) return '—';
  if (v.editors.length === 1 && v.cameramen.length === 1 && v.editors[0].id === v.cameramen[0].id) {
    return `${v.editors[0].full_name} — Monteur & Caméraman`;
  }
  return v.editor_name ?? '—';
}

/** Colonne « Cadreur » : tiret si un seul assigné commun aux deux rôles (déjà indiqué à gauche). */
export function videoCadreurTableCell(v: AssigneeRow): string {
  if (v.editors.length === 1 && v.cameramen.length === 1 && v.editors[0].id === v.cameramen[0].id) return '—';
  return v.cameraman_name ?? '—';
}

/** Ligne compacte Kanban / cartes. */
export function videoKanbanAssigneeSummary(v: AssigneeRow): string {
  const ed = v.editors.map((x) => x.full_name).join(', ') || null;
  const cam = v.cameramen.map((x) => x.full_name).join(', ') || null;
  if (ed && cam) {
    if (v.editors.length === 1 && v.cameramen.length === 1 && v.editors[0].id === v.cameramen[0].id) {
      return `Monteur & caméraman : ${ed}`;
    }
    return `Monteurs : ${ed} · Cam : ${cam}`;
  }
  if (ed) return `Monteurs : ${ed}`;
  if (cam) return `Cam : ${cam}`;
  return '—';
}
