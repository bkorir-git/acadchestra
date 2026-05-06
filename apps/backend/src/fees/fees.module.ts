/**
 * @file fees.module.ts
 * @description Umbrella Fee Module for Acadchestra. Wires every
 *   sub-service and controller, exposes the ones the rest of the app
 *   (Academic module, schedulers, notifications) actually depends on,
 *   and pulls in the newfeatures:
 *
 *     - FeeCategoryEntity (custom categories beyond the system enum)
 *     - FeePaymentRule (by-week % cadence)
 *     - FeeStructureResolverService (the /resolve endpoint)
 *     - FeeDownloadsService (Puppeteer PDF + docx@9 Word)
 *     - PdfRendererService / WordRendererService (singletons)
 *
 *   ledger primitive first, then
 *   resolvers, then engines that consume them.
 */

import { Module, forwardRef } from '@nestjs/common';
import { ActivityModule } from '../common/activity/activity.module';
import { AcademicModule } from '../academic/academic.module';

// ─── Categories ─────────────────────────────────────────────────────
import { FeeCategoriesController } from './categories/fee-categories.controller';
import { FeeCategoriesService } from './categories/fee-categories.service';

// ─── Structures ─────────────────────────────────────────────────────
import { FeeStructuresController } from './structures/fee-structures.controller';
import { FeeStructuresService } from './structures/fee-structures.service';
import { FeeStructureVersionsService } from './structures/fee-structure-versions.service';
import { FeeStructureResolverService } from './structures/fee-structure-resolver.service';

// ─── Payment rules ──────────────────────────────────────────────────
import { FeePaymentRulesController } from './payment-rules/fee-payment-rules.controller';
import { FeePaymentRulesService } from './payment-rules/fee-payment-rules.service';

// ─── Billing ────────────────────────────────────────────────────────
import { BillingController } from './billing/billing.controller';
import { BillingService } from './billing/billing.service';

// ─── Student fees ───────────────────────────────────────────────────
import { StudentFeesController } from './student-fees/student-fees.controller';
import { StudentFeesService } from './student-fees/student-fees.service';
import { StudentStatementService } from './student-fees/student-statement.service';

// ─── Payments ───────────────────────────────────────────────────────
import { FeePaymentsController } from './payments/fee-payments.controller';
import { FeePaymentsService } from './payments/fee-payments.service';
import { PaymentAllocatorService } from './payments/payment-allocator.service';

// ─── Invoices ───────────────────────────────────────────────────────
import { InvoicesController } from './invoices/invoices.controller';
import { InvoicesService } from './invoices/invoices.service';

// ─── Discounts ──────────────────────────────────────────────────────
import { DiscountsController } from './discounts/discounts.controller';
import { DiscountsService } from './discounts/discounts.service';

// ─── Ledger ─────────────────────────────────────────────────────────
import { FeeLedgerController } from './ledger/fee-ledger.controller';
import { FeeLedgerService } from './ledger/fee-ledger.service';

// ─── Arrears ────────────────────────────────────────────────────────
import { ArrearsController } from './arrears/arrears.controller';
import { ArrearsService } from './arrears/arrears.service';

// ─── Financial lock ─────────────────────────────────────────────────
import { FinancialLockController } from './financial-lock/financial-lock.controller';
import { FinancialLockService } from './financial-lock/financial-lock.service';

// ─── Reports ────────────────────────────────────────────────────────
import { FeeReportsController } from './reports/fee-reports.controller';
import { FeeReportsService } from './reports/fee-reports.service';

// ─── Downloads ──────────────────────────────────────────────────────
import { FeeDownloadsController } from './downloads/fee-downloads.controller';
import { FeeDownloadsService } from './downloads/fee-downloads.service';
import { PdfRendererService } from './downloads/pdf-renderer.service';
import { WordRendererService } from './downloads/word-renderer.service';

@Module({
  imports: [ActivityModule, forwardRef(() => AcademicModule)],
  controllers: [
    FeeCategoriesController,
    FeeStructuresController,
    FeePaymentRulesController,
    BillingController,
    StudentFeesController,
    FeePaymentsController,
    InvoicesController,
    DiscountsController,
    FeeLedgerController,
    ArrearsController,
    FinancialLockController,
    FeeReportsController,
    FeeDownloadsController,
  ],
  providers: [
    // Ledger primitive (everything depends on it)
    FeeLedgerService,

    // Categories
    FeeCategoriesService,

    // Structures
    FeeStructureVersionsService,
    FeeStructureResolverService,
    FeeStructuresService,

    // Payment rules
    FeePaymentRulesService,

    // Billing
    BillingService,

    // Student fees
    StudentFeesService,
    StudentStatementService,

    // Payments
    PaymentAllocatorService,
    FeePaymentsService,

    // Invoices
    InvoicesService,

    // Discounts
    DiscountsService,

    // Arrears + Lock
    ArrearsService,
    FinancialLockService,

    // Reports
    FeeReportsService,

    // Downloads
    PdfRendererService,
    WordRendererService,
    FeeDownloadsService,
  ],
  exports: [
    FeeCategoriesService,
    FeeStructuresService,
    FeeStructureResolverService,
    FeePaymentRulesService,
    BillingService,
    StudentFeesService,
    FeePaymentsService,
    InvoicesService,
    DiscountsService,
    FeeLedgerService,
    ArrearsService,
    FinancialLockService,
    PdfRendererService,
    WordRendererService,
  ],
})
export class FeesModule {}