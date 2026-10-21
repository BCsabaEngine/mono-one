// kept free of imports: the Drizzle schemas load this file by relative path (drizzle-kit ignores tsconfig paths)
/** Code-only lists, stored as text columns (no database enum types). */
export const ADDRESS_TYPES = ['hq', 'site', 'mail'] as const
export const CONTACT_TYPES = ['stock', 'management', 'sales'] as const
/** EU member states, ISO 3166-1 alpha-2. */
export const EU_COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE'
] as const
