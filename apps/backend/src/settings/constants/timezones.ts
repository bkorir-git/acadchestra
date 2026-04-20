/**
 * @description Common timezones for tenant settings selector.
 */

export interface TimezoneInfo {
  value: string;
  label: string;
  offset: string;
}

export const TIMEZONES: TimezoneInfo[] = [
  { value: 'Africa/Nairobi', label: 'Nairobi', offset: '+03:00' },
  { value: 'Africa/Kampala', label: 'Kampala', offset: '+03:00' },
  { value: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam', offset: '+03:00' },
  { value: 'Africa/Kigali', label: 'Kigali', offset: '+02:00' },
  { value: 'Africa/Lagos', label: 'Lagos', offset: '+01:00' },
  { value: 'Africa/Accra', label: 'Accra', offset: '+00:00' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg', offset: '+02:00' },
  { value: 'Africa/Cairo', label: 'Cairo', offset: '+02:00' },
  { value: 'Africa/Addis_Ababa', label: 'Addis Ababa', offset: '+03:00' },
  { value: 'UTC', label: 'UTC', offset: '+00:00' },
  { value: 'Europe/London', label: 'London', offset: '+00:00' },
  { value: 'Europe/Paris', label: 'Paris', offset: '+01:00' },
  { value: 'America/New_York', label: 'New York', offset: '-05:00' },
  { value: 'America/Los_Angeles', label: 'Los Angeles', offset: '-08:00' },
  { value: 'Asia/Dubai', label: 'Dubai', offset: '+04:00' },
  { value: 'Asia/Kolkata', label: 'Kolkata', offset: '+05:30' },
  { value: 'Asia/Singapore', label: 'Singapore', offset: '+08:00' },
  { value: 'Asia/Tokyo', label: 'Tokyo', offset: '+09:00' },
  { value: 'Australia/Sydney', label: 'Sydney', offset: '+10:00' },
];

export const LOCALES = [
  { value: 'en-KE', label: 'English (Kenya)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-ZA', label: 'English (South Africa)' },
  { value: 'en-NG', label: 'English (Nigeria)' },
  { value: 'sw-KE', label: 'Swahili' },
  { value: 'fr-FR', label: 'French' },
  { value: 'ar-AE', label: 'Arabic' },
];

export const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: '31/12/2026' },
  { value: 'MM/DD/YYYY', label: '12/31/2026' },
  { value: 'YYYY-MM-DD', label: '2026-12-31' },
  { value: 'DD MMM YYYY', label: '31 Dec 2026' },
  { value: 'MMM DD, YYYY', label: 'Dec 31, 2026' },
];
