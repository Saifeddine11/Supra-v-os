import { format, parseISO } from 'date-fns';

/** Format ISO timestamp for `<input type="datetime-local">` in local wall clock. */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
}
