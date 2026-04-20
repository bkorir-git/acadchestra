/**
 * @description ISO 4217 currency catalog for tenant settings dropdowns.
 */

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', decimals: 0 },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', decimals: 2 },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'RF', decimals: 0 },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2 },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
  { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', decimals: 2 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2 },
];

export function findCurrency(code: string): CurrencyInfo | undefined {
  return CURRENCIES.find((c) => c.code === code.toUpperCase());
}
