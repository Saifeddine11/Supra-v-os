/**
 * Devise agence — codes ISO en base (MAD, EUR, USD…).
 * Affichage : EUR/GBP en symbole, autres en code (MAD, USD, AED…).
 */

export const AGENCY_CURRENCY_ISO = ['MAD', 'EUR', 'USD', 'GBP', 'AED', 'SAR'] as const;
export type AgencyCurrencyIso = (typeof AGENCY_CURRENCY_ISO)[number];

const ALLOWED = new Set<string>(AGENCY_CURRENCY_ISO);

const SYMBOL_MAP: Record<string, string> = {
  '€': 'EUR',
  EURO: 'EUR',
  EUROS: 'EUR',
  '£': 'GBP',
  GBP: 'GBP',
  $: 'USD',
  USD: 'USD',
  'US$': 'USD',
  DH: 'MAD',
  DHS: 'MAD',
  'DHS.': 'MAD',
  MAD: 'MAD',
  DIRHAM: 'MAD',
  AED: 'AED',
  SAR: 'SAR',
};

/** Options select Paramètres (valeur = ISO stocké en base). */
export const AGENCY_CURRENCY_SELECT_OPTIONS: { value: AgencyCurrencyIso; label: string }[] = [
  { value: 'MAD', label: 'MAD — Dirham marocain' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'USD', label: 'USD — Dollar US' },
  { value: 'GBP', label: 'GBP — Livre sterling' },
  { value: 'AED', label: 'AED — Dirham émirati' },
  { value: 'SAR', label: 'SAR — Riyal saoudien' },
];

export function normalizeAgencyCurrency(input: string | null | undefined): AgencyCurrencyIso {
  const raw = (input ?? '').trim();
  if (!raw) return 'MAD';
  const u = raw.toUpperCase();
  if (SYMBOL_MAP[raw]) return SYMBOL_MAP[raw] as AgencyCurrencyIso;
  if (SYMBOL_MAP[u]) return SYMBOL_MAP[u] as AgencyCurrencyIso;
  if (ALLOWED.has(u)) return u as AgencyCurrencyIso;
  return 'MAD';
}

export function isAllowedAgencyCurrency(iso: string): iso is AgencyCurrencyIso {
  return ALLOWED.has(iso.toUpperCase());
}

/** True si la saisie est vide, un code ISO autorisé, ou un alias connu (€, DH…). */
export function isRecognizedAgencyCurrencyInput(input: string | null | undefined): boolean {
  const raw = (input ?? '').trim();
  if (!raw) return true;
  const u = raw.toUpperCase();
  if (ALLOWED.has(u)) return true;
  if (SYMBOL_MAP[raw]) return true;
  if (SYMBOL_MAP[u]) return true;
  return false;
}

/** Suffixe affiché après le montant (ex. €, MAD). */
export function agencyCurrencyDisplaySuffix(iso: string): string {
  const c = normalizeAgencyCurrency(iso);
  if (c === 'EUR') return '€';
  if (c === 'GBP') return '£';
  return c;
}

/**
 * Formate un montant pour l’UI (fr-FR).
 * Pas de conversion de devise : `amount` reste le nombre métier.
 */
export function formatAgencyMoney(
  amount: number | null | undefined,
  currencyInput: string | null | undefined,
  options?: { minFractionDigits?: number; maxFractionDigits?: number }
): string {
  const iso = normalizeAgencyCurrency(currencyInput);
  const minF = options?.minFractionDigits ?? 2;
  const maxF = options?.maxFractionDigits ?? 2;
  const n = amount == null || Number.isNaN(Number(amount)) ? 0 : Number(amount);
  const num = n.toLocaleString('fr-FR', {
    minimumFractionDigits: minF,
    maximumFractionDigits: maxF,
  });
  return `${num}\u00A0${agencyCurrencyDisplaySuffix(iso)}`;
}

export function formatAgencyMoneyCompact(
  amount: number | null | undefined,
  currencyInput: string | null | undefined
): string {
  return formatAgencyMoney(amount, currencyInput, { minFractionDigits: 0, maxFractionDigits: 0 });
}
