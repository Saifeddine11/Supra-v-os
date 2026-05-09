/**
 * App-wide constants
 */

export const APP_NAME = 'Supra v. Agency OS';
export const APP_DOMAIN = 'app.suprav3.com';

export const AGENCY = {
  name:    process.env.NEXT_PUBLIC_AGENCY_NAME ?? 'Supra v.',
  email:   process.env.NEXT_PUBLIC_AGENCY_EMAIL ?? 'hello@suprav3.com',
  phone:   process.env.NEXT_PUBLIC_AGENCY_PHONE ?? '+212 6 00 00 00 00',
  address: process.env.NEXT_PUBLIC_AGENCY_ADDRESS ?? 'Marrakech, Maroc',
};

/** App URL (used in emails, portal links). */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/** Token expiry for portals (1 year by default). */
export const PORTAL_TOKEN_EXPIRY_DAYS = 365;

/** Default tax rate (Morocco VAT typically 20% for services). */
export const DEFAULT_TAX_RATE = 0; // Many MA agencies invoice without VAT — adjust per business
export const DEFAULT_CURRENCY = 'MAD';

/** Cron schedule reference (in vercel.json) */
export const CRON_SCHEDULES = {
  morningReminders: '0 8 * * *',  // 09:00 Africa/Casablanca → 08:00 UTC
  eveningSummary:   '0 17 * * *', // 18:00 Africa/Casablanca → 17:00 UTC
  deadlineAlerts:   '0 */2 * * *',// Every 2 hours
  overdueInvoices:  '0 6 * * *',  // 07:00 local → 06:00 UTC
} as const;

/** Workload alert thresholds */
export const WORKLOAD_THRESHOLDS = {
  overload: 80,
  available: 60,
} as const;
