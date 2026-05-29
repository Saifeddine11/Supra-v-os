import {
  DRAFT_ASSIGNEE_NOT_FOUND,
  DRAFT_CLIENT_NOT_FOUND,
} from '@/lib/ai/supai-copy';

export type DraftReferencePreview = {
  status: string;
  query?: string;
  label?: string;
  id?: string;
  matchedVia?: string;
  matches?: Array<{ id: string; label: string }>;
};

export function draftReferenceResolvedHint(
  preview: DraftReferencePreview | undefined,
  inputName: string,
): string | null {
  if (!preview || preview.status !== 'resolved' || !preview.label) return null;
  const input = inputName.trim();
  if (!input) return null;
  if (input.localeCompare(preview.label, 'fr', { sensitivity: 'base' }) === 0) {
    return null;
  }
  return `${input} → ${preview.label}`;
}

export function draftReferenceBlockingWarning(
  kind: 'client' | 'assignee',
  preview: DraftReferencePreview | undefined,
  name: string,
  selectedId: string,
): string | null {
  if (!name.trim()) return null;
  if (selectedId) return null;
  if (!preview || preview.status === 'none') return null;
  if (preview.status === 'resolved') return null;
  if (preview.status === 'not_found') {
    return kind === 'client'
      ? `${DRAFT_CLIENT_NOT_FOUND} : ${name}`
      : `${DRAFT_ASSIGNEE_NOT_FOUND} : ${name}`;
  }
  if (preview.status === 'ambiguous') {
    const options =
      preview.matches?.map((m) => `- ${m.label}`).join('\n') ?? '';
    return kind === 'client'
      ? `J'ai trouvé plusieurs clients pour « ${name} » :\n${options}\nChoisissez le bon client.`
      : `J'ai trouvé plusieurs personnes pour « ${name} » :\n${options}\nChoisissez la bonne personne.`;
  }
  return null;
}

export function draftReferenceBlocksConfirm(
  preview: DraftReferencePreview | undefined,
  name: string,
  selectedId: string,
): boolean {
  if (!name.trim()) return false;
  if (selectedId) return false;
  if (!preview || preview.status === 'none' || preview.status === 'resolved') return false;
  return preview.status === 'not_found' || preview.status === 'ambiguous';
}
