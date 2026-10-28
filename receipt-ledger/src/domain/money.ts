/**
 * Money helpers. Amounts are stored as integer minor units (paisa for PKR).
 * Conversions go through strings so no float ever reaches storage.
 */

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
];

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

/**
 * Parses user input like "1,250", "1250.5", "Rs 1,250.00" into minor units.
 * Returns null for empty or invalid input. Negative input is rejected.
 */
export function parseMoneyInput(input: string | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = String(input)
    .replace(/rs\.?|pkr|₨/gi, '')
    .replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const value = parseInt(whole, 10) * 100 + parseInt(frac.padEnd(2, '0') || '0', 10);
  return Number.isSafeInteger(value) ? value : null;
}

/** Groups thousands in the Pakistani style used by banks (1,234,567). */
function groupThousands(n: string): string {
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 125000 → "1,250.00" (no symbol). */
export function formatMinor(minor: number, opts: { decimals?: 'auto' | 'always' } = {}): string {
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const showDecimals = opts.decimals === 'always' || frac !== 0;
  const body = groupThousands(String(whole)) + (showDecimals ? `.${String(frac).padStart(2, '0')}` : '');
  return negative ? `-${body}` : body;
}

/** 125000, "PKR" → "Rs 1,250". */
export function formatMoney(minor: number, currency = 'PKR', opts: { sign?: boolean } = {}): string {
  const symbol = currencySymbol(currency);
  const sign = minor < 0 ? '−' : opts.sign && minor > 0 ? '+' : '';
  return `${sign}${symbol} ${formatMinor(Math.abs(minor))}`;
}

/** Minor units → editable input string ("1250.5" → "1250.50", whole numbers without decimals). */
export function minorToInput(minor: number | null | undefined): string {
  if (minor == null) return '';
  const whole = Math.floor(Math.abs(minor) / 100);
  const frac = Math.abs(minor) % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, '0')}`;
}
