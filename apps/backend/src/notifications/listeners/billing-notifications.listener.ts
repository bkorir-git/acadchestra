/**
 * @file billing-notifications.listener.ts
 * @description Subscribes to FEE_EVENTS.* and converts them into in-app /
 *   email / SMS / push notifications. The listener stays "thin" — channel
 *   resolution and recipient lookup live in `NotificationsService`.
 *
 *   Wired events:
 *     - billing.previewed / billing.executed
 *     - invoice.issued / invoice.cancelled
 *     - payment.recorded / payment.voided
 *     - fee.due_soon / fee.overdue / fee.arrears_alert
 *     - payment-rule.violated
 *     - financial-lock.applied / released
 *     - arrears.rolled
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { FEE_EVENTS } from '../../fees/common/fee-events.constants';

@Injectable()
export class BillingNotificationsListener {
  private readonly logger = new Logger(BillingNotificationsListener.name);

  constructor(private readonly notifications: NotificationsService) {}

  // ─── Billing ──────────────────────────────────────────────────
  @OnEvent(FEE_EVENTS.BILLING_EXECUTED)
  async onBillingCompleted(payload: any) {
    await this.notifications.notifyAdmins(payload.tenantId, {
      code: 'BILLING_RUN_COMPLETED',
      title: 'Billing run completed',
      body: `Billed ${payload.summary.billed}, skipped ${payload.summary.skipped}, already-billed ${payload.summary.alreadyBilled}. Total: ${payload.summary.totalAmount}`,
      meta: payload.summary,
    });
  }

  @OnEvent(FEE_EVENTS.BILLING_PREVIEWED)
  async onBillingPreviewed(_payload: any) {
    /* preview is intentionally silent */
  }

  // ─── Invoices ─────────────────────────────────────────────────
  @OnEvent(FEE_EVENTS.INVOICE_ISSUED)
  async onInvoiceIssued(p: any) {
    if (!p?.invoiceId) return;
    await this.notifications.broadcastForInvoices(p.tenantId, [p.invoiceId]);
  }

  @OnEvent(FEE_EVENTS.INVOICE_CANCELLED)
  async onInvoiceCancelled(p: any) {
    await this.notifications.notifyAdmins(p.tenantId, {
      code: 'INVOICE_CANCELLED',
      title: 'Invoice cancelled',
      body: `Invoice ${p.invoiceId} has been cancelled.`,
      meta: p,
    });
  }

  // ─── Payments ─────────────────────────────────────────────────
  @OnEvent(FEE_EVENTS.PAYMENT_RECORDED)
  async onPaymentRecorded(p: any) {
    if (!p?.payment?.studentId) return;
    await this.notifications.notifyGuardians(
      p.tenantId,
      p.payment.studentId,
      {
        code: 'PAYMENT_RECEIVED',
        title: 'Payment received',
        body: `We received ${p.payment.amount} via ${p.payment.method}. Thank you.`,
        meta: { paymentId: p.payment.id },
      },
    );
  }

  @OnEvent(FEE_EVENTS.PAYMENT_VOIDED)
  async onPaymentVoided(p: any) {
    await this.notifications.notifyAdmins(p.tenantId, {
      code: 'PAYMENT_VOIDED',
      title: 'Payment voided',
      body: `Payment ${p.paymentId} was voided. Reason: ${p.reason}`,
      meta: p,
    });
  }

  // ─── Reminders ────────────────────────────────────────────────
  @OnEvent(FEE_EVENTS.FEE_DUE_SOON)
  async onFeeDueSoon(p: any) {
    await this.notifications.notifyGuardians(p.tenantId, p.studentId, {
      code: 'FEE_DUE_SOON',
      title: 'Fee due soon',
      body: `Outstanding balance: ${p.balance}. Due on ${new Date(p.dueDate).toDateString()}.`,
      meta: p,
    });
  }

  @OnEvent(FEE_EVENTS.FEE_OVERDUE)
  async onFeeOverdue(p: any) {
    await this.notifications.notifyGuardians(p.tenantId, p.studentId, {
      code: 'FEE_OVERDUE',
      title: 'Fee overdue',
      body: `Your payment of ${p.balance} is now overdue. Please settle to avoid penalties.`,
      meta: p,
    });
  }

  @OnEvent(FEE_EVENTS.FEE_ARREARS_ALERT)
  async onArrearsAlert(p: any) {
    await this.notifications.notifyGuardians(p.tenantId, p.studentId, {
      code: 'FEE_ARREARS_ALERT',
      title: 'Arrears outstanding',
      body: `Arrears (${p.daysOverdue} days): ${p.balance}. Please contact the finance office.`,
      meta: p,
    });
  }

  @OnEvent(FEE_EVENTS.PAYMENT_RULE_VIOLATED)
  async onRuleViolated(p: any) {
    await this.notifications.notifyGuardians(p.tenantId, p.studentId, {
      code: 'PAYMENT_RULE_VIOLATED',
      title: 'Payment schedule missed',
      body: `Required payment for week ${p.weeksLate} not met. Please reach out to finance.`,
      meta: p,
    });
  }

  // ─── Locks ────────────────────────────────────────────────────
  @OnEvent(FEE_EVENTS.FINANCIAL_LOCK_APPLIED)
  async onFinancialLock(p: any) {
    await this.notifications.notifyAdmins(p.tenantId, {
      code: 'FINANCIAL_LOCK_APPLIED',
      title: 'Financial lock applied',
      body: `${p.scope} ${p.id} is now financially locked.`,
      meta: p,
    });
  }

  @OnEvent(FEE_EVENTS.FINANCIAL_LOCK_RELEASED)
  async onFinancialUnlock(p: any) {
    await this.notifications.notifyAdmins(p.tenantId, {
      code: 'FINANCIAL_LOCK_RELEASED',
      title: 'Financial lock released',
      body: `${p.scope} ${p.id} has been unlocked.`,
      meta: p,
    });
  }

  // ─── Arrears roll-forward ─────────────────────────────────────
  @OnEvent(FEE_EVENTS.ARREARS_ROLLED)
  async onArrearsRolled(p: any) {
    await this.notifications.notifyAdmins(p.tenantId, {
      code: 'ARREARS_ROLLED',
      title: 'Arrears rolled forward',
      body: `${p.rolled} students rolled (${p.totalRolled}) from ${p.fromTerm} → ${p.toTerm}.`,
      meta: p,
    });
  }
}