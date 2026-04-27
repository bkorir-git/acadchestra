/**
 * @file default-configs.seed.ts
 * @description Canonical default configs map. Per-tenant bootstrap concern,
 *   not a global seeder. The Tenant bootstrap calls `ConfigService.seedDefaultsForTenant`
 *   which writes these on first install.
 */

import type { Prisma } from '@prisma/client';

export interface DefaultConfig {
  category: string;
  key: string;
  value: Prisma.InputJsonValue;
  description?: string;
}

export const DEFAULT_TENANT_CONFIGS: DefaultConfig[] = [
  // ── ACADEMIC ──
  { category: 'academic', key: 'enableStreams', value: true },
  { category: 'academic', key: 'maxStreamsPerClass', value: 5 },
  { category: 'academic', key: 'autoArchiveOldYears', value: true },
  { category: 'academic', key: 'attendanceThresholdPct', value: 75 },
  { category: 'academic', key: 'defaultGradingScale', value: 'PERCENTAGE' },
  { category: 'academic', key: 'passingGradePct', value: 50 },

  // ── STUDENT ──
  { category: 'student', key: 'requireEmail', value: false },
  { category: 'student', key: 'requirePhone', value: false },
  { category: 'student', key: 'autoGenerateRollNumber', value: true },
  { category: 'student', key: 'requireGuardianBelowAge', value: 18 },
  {
    category: 'student',
    key: 'admissionNumberStrategy',
    value: 'YEAR_PREFIXED',
  },
  { category: 'student', key: 'admissionNumberPrefix', value: '' },
  { category: 'student', key: 'admissionNumberPadding', value: 4 },
  { category: 'student', key: 'allowDuplicatePhone', value: true },

  // ── GUARDIAN ──
  {
    category: 'guardian',
    key: 'allowedRelationships',
    value: [
      'MOTHER',
      'FATHER',
      'STEP_MOTHER',
      'STEP_FATHER',
      'GUARDIAN',
      'GRANDMOTHER',
      'GRANDFATHER',
      'UNCLE',
      'AUNT',
      'SIBLING',
      'OTHER',
    ],
  },
  { category: 'guardian', key: 'requirePrimaryContact', value: true },
  { category: 'guardian', key: 'maxGuardiansPerStudent', value: 4 },
  { category: 'guardian', key: 'requireEmergencyContact', value: true },

  // ── FEE ──
  { category: 'fee', key: 'enableLateFees', value: true },
  { category: 'fee', key: 'lateFeePercentage', value: 5 },
  { category: 'fee', key: 'lateFeeGraceDays', value: 7 },
  { category: 'fee', key: 'allowStreamLevelFees', value: true },
  { category: 'fee', key: 'allowPartialPayments', value: true },
  { category: 'fee', key: 'allowOverpayment', value: false },
  { category: 'fee', key: 'requirePaymentReference', value: false },
  { category: 'fee', key: 'autoCarryForwardArrears', value: true },
  { category: 'fee', key: 'defaultAllocationStrategy', value: 'FIFO' },
  {
    category: 'fee',
    key: 'enabledPaymentMethods',
    value: ['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CHEQUE'],
  },
  { category: 'fee', key: 'receiptPrefix', value: 'RCP' },
  { category: 'fee', key: 'invoicePrefix', value: 'INV' },
  {
    category: 'fee',
    key: 'termPaymentSchedule',
    value: [
      { byWeek: 2, minPercentage: 50 },
      { byWeek: 6, minPercentage: 100 },
    ],
  },

  // ── SECURITY ──
  { category: 'security', key: 'sessionTimeoutMinutes', value: 60 },
  { category: 'security', key: 'passwordMinLength', value: 8 },
  { category: 'security', key: 'passwordRequireUppercase', value: true },
  { category: 'security', key: 'passwordRequireNumber', value: true },
  { category: 'security', key: 'passwordRequireSymbol', value: false },
  { category: 'security', key: 'requireTwoFactor', value: false },
  { category: 'security', key: 'maxLoginAttempts', value: 5 },
  { category: 'security', key: 'lockoutDurationMinutes', value: 15 },

  // ── COMMS ──
  { category: 'comms', key: 'enableEmailNotifications', value: true },
  { category: 'comms', key: 'enableSmsNotifications', value: false },
  { category: 'comms', key: 'enablePushNotifications', value: false },
  { category: 'comms', key: 'feeReminderDays', value: [7, 3, 1] },
  { category: 'comms', key: 'termActivationReminderDays', value: [7, 3, 1] },

  // ── FEATURES ──
  { category: 'features', key: 'enableParentPortal', value: true },
  { category: 'features', key: 'enableStudentPortal', value: true },
  { category: 'features', key: 'enableOnlinePayments', value: false },
  { category: 'features', key: 'enableBulkImport', value: true },
  { category: 'features', key: 'enableAutoPromotion', value: false },
];
