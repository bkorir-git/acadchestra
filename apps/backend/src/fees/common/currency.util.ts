/**
 * @file currency.util.ts
 * @description Locale-aware currency formatting helpers used by PDF/Word
 *   renderers and Excel exports. Falls back gracefully if locale missing.
 */

export interface CurrencyContext {
  currency: string; // 'KES'
  currencySymbol: string; // 'KSh'
  currencyPosition: 'BEFORE' | 'AFTER';
  currencyDecimals: number;
  locale: string; // 'en-KE'
}

export const DEFAULT_CURRENCY: CurrencyContext = {
  currency: 'KES',
  currencySymbol: 'KSh',
  currencyPosition: 'BEFORE',
  currencyDecimals: 2,
  locale: 'en-KE',
};

export function formatMoney(
  amount: number,
  ctx: Partial<CurrencyContext> = {},
): string {
  const c: CurrencyContext = { ...DEFAULT_CURRENCY, ...ctx };
  const safe = Number.isFinite(amount) ? amount : 0;
  let formatted: string;
  try {
    formatted = safe.toLocaleString(c.locale, {
      minimumFractionDigits: c.currencyDecimals,
      maximumFractionDigits: c.currencyDecimals,
    });
  } catch {
    formatted = safe.toFixed(c.currencyDecimals);
  }
  return c.currencyPosition === 'BEFORE'
    ? `${c.currencySymbol} ${formatted}`
    : `${formatted} ${c.currencySymbol}`;
}

export function formatDateLocale(
  date: Date | string,
  locale = 'en-KE',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return d.toISOString().split('T')[0];
  }
}
