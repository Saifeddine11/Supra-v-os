import { format, formatDistanceToNow, isToday, isYesterday, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Format a number as currency (default MAD).
 */
export function formatCurrency(amount: number, currency = 'MAD'): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${currency}`;
}

/**
 * Format a date in French style: "8 mai 2026"
 */
export function formatDate(date: string | Date, pattern = 'd MMMM yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, pattern, { locale: fr });
}

/**
 * Short date format: "08/05/26"
 */
export function formatDateShort(date: string | Date): string {
  return formatDate(date, 'dd/MM/yy');
}

/**
 * Relative time: "il y a 3 heures" / "dans 2 jours"
 */
export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { locale: fr, addSuffix: true });
}

/**
 * Smart date label: "Aujourd'hui", "Hier", "Dans 3 jours", or full date
 */
export function formatSmartDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isToday(d)) return "Aujourd'hui";
  if (isYesterday(d)) return 'Hier';
  const diff = differenceInDays(d, new Date());
  if (diff > 0 && diff <= 7) return `Dans ${diff} jour${diff > 1 ? 's' : ''}`;
  if (diff < 0 && diff >= -7) return `Il y a ${-diff} jour${-diff > 1 ? 's' : ''}`;
  return formatDate(d);
}

/**
 * Initials from a full name: "Yasmine Kabbaj" → "YK"
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Determine if a date is in the past
 */
export function isOverdue(date: string | Date | null): boolean {
  if (!date) return false;
  const d = typeof date === 'string' ? new Date(date) : date;
  return d < new Date();
}

/**
 * Format duration in seconds to human readable: "1m 30s"
 */
export function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}min`;
  return `${m}m ${s}s`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string | null, max: number): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
