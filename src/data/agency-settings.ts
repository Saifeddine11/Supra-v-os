/**
 * Paramètres agence — valeurs par défaut UI. Persistance : table `agency_settings` (voir /settings).
 */

export interface AgencySettings {
  agencyName: string;
  logoUrl: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  website: string | null;
  taxId: string | null;
  invoicePrefix: string;
  quotePrefix: string;
  defaultCurrency: string;
  defaultPaymentTerms: string;
  defaultTaxRatePercent: number;
  portalBaseUrl: string | null;
  portalShowBranding: boolean;
}

export const AGENCY_SETTINGS_STORAGE_KEY = 'supra-agency-settings-v1';

export const DEFAULT_AGENCY_SETTINGS: AgencySettings = {
  agencyName: 'Supra v.',
  logoUrl: null,
  email: 'contact@suprav3.com',
  phone: null,
  address: null,
  website: 'https://suprav3.com',
  taxId: null,
  invoicePrefix: 'INV-',
  quotePrefix: 'DEV-',
  defaultCurrency: 'MAD',
  defaultPaymentTerms: 'Paiement à 30 jours net.',
  defaultTaxRatePercent: 20,
  portalBaseUrl: null,
  portalShowBranding: true,
};

export function mergeAgencySettings(partial: Partial<AgencySettings>): AgencySettings {
  return { ...DEFAULT_AGENCY_SETTINGS, ...partial };
}
