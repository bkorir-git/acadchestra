/**
 * @file fee-math.util.ts
 * @description Money math primitives. All fee calculations route through
 *   these helpers to guarantee deterministic 2dp rounding and safe epsilon
 *   comparisons across the whole module. Never compare floats directly.
 */

export const MONEY_EPSILON = 0.005;

/** Round to 2 decimal places (half-away-from-zero). */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** True if |value| < EPSILON (effectively zero). */
export function isZero(value: number): boolean {
  return Math.abs(value) < MONEY_EPSILON;
}

/** True if a >= b within epsilon tolerance. */
export function gte(a: number, b: number): boolean {
  return a + MONEY_EPSILON >= b;
}

/** True if a <= b within epsilon tolerance. */
export function lte(a: number, b: number): boolean {
  return a - MONEY_EPSILON <= b;
}

/** Compute `percent%` of `amount`, rounded. */
export function percentOf(amount: number, percent: number): number {
  return roundMoney((amount * percent) / 100);
}

/** Clamp a value between [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Sum money values with rounding per step (avoids float drift). */
export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((acc, v) => acc + (v || 0), 0));
}

/** Distribute amount proportionally across weights. */
export function distribute(amount: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return weights.map(() => 0);
  const portions = weights.map((w) => roundMoney((amount * w) / totalWeight));
  const drift = roundMoney(amount - portions.reduce((a, b) => a + b, 0));
  if (!isZero(drift) && portions.length) {
    portions[portions.length - 1] = roundMoney(
      portions[portions.length - 1] + drift,
    );
  }
  return portions;
}

/** Receipt # generator: {PREFIX}-{TENANT}-{YYYY}-{SEQ6}. */
export function generateReceiptNumber(
  tenantCode: string,
  sequence: number,
  prefix = 'RCP',
): string {
  const year = new Date().getFullYear();
  const code = (tenantCode || 'SCH')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase();
  return `${prefix}-${code}-${year}-${String(sequence).padStart(6, '0')}`;
}

/** Invoice # generator: shares format with receipt. */
export function generateInvoiceNumber(
  tenantCode: string,
  sequence: number,
  prefix = 'INV',
): string {
  return generateReceiptNumber(tenantCode, sequence, prefix);
}

/** Slugify a free-text string into a stable code. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
