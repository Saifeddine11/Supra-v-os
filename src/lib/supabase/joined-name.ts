/** PostgREST may return embedded FK as object or single-element array depending on typing. */
export function joinedRelationName(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw) && 'name' in raw) {
    const n = (raw as { name: unknown }).name;
    return typeof n === 'string' ? n : null;
  }
  if (Array.isArray(raw) && raw[0] && typeof raw[0] === 'object' && raw[0] !== null && 'name' in raw[0]) {
    const n = (raw[0] as { name: unknown }).name;
    return typeof n === 'string' ? n : null;
  }
  return null;
}
