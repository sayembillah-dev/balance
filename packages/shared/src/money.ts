/**
 * Money is stored everywhere as an integer number of minor units (e.g. paise,
 * cents) to avoid floating-point drift. Each currency has its own exponent
 * (number of minor units per major unit), so conversion/formatting must be
 * currency-aware. Values are kept as JS `number`; the safe ceiling is
 * Number.MAX_SAFE_INTEGER (2^53 − 1) minor units — ample for personal finance.
 */

/** Minor-unit exponent per ISO-4217 currency. Extend as currencies are added. */
export const CURRENCY_EXPONENTS: Record<string, number> = {
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  BDT: 2,
  JPY: 0,
};

export const DEFAULT_CURRENCY = 'INR';

export function exponentFor(currency: string): number {
  return CURRENCY_EXPONENTS[currency] ?? 2;
}

/** Convert a major-unit amount (e.g. 2100.50 rupees) to integer minor units. */
export function toMinor(major: number, currency: string): number {
  const factor = 10 ** exponentFor(currency);
  return Math.round(major * factor);
}

/** Convert integer minor units back to a major-unit number. */
export function toMajor(minor: number, currency: string): number {
  const factor = 10 ** exponentFor(currency);
  return minor / factor;
}

/** Locale-aware currency string from minor units, e.g. 210000 INR → "₹2,100.00". */
export function formatMinor(
  minor: number,
  currency: string,
  locale = 'en-IN',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: exponentFor(currency),
  }).format(toMajor(minor, currency));
}
