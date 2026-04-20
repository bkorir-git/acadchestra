/**
 * @description Event listener that turns academic & fee events into user-facing notifications.
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { EVENTS } from '../../common/events/events.constants';
import type {
  ArrearsRolledOverPayload,
  BillingGeneratedPayload,
  FeeDueSoonPayload,
  FeeOverduePayload,
  PaymentRecordedPayload,
  StudentPromotedPayload,
  TermActivatedPayload,
  TermOverduePayload,
  TermStartingSoonPayload,
} from '../../common/events/events.payloads';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AcademicNotificationsListener {
  private readonly logger = new Logger(AcademicNotificationsListener.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  // ─────────────────────────── TERM EVENTS
  @OnEvent(EVENTS.TERM_ACTIVATED)
  async onTermActivated(payload: TermActivatedPayload) {
    await this.notifications.broadcast(
      payload.tenantId,
      {
        type: NotificationType.TERM_ACTIVATED,
        title: `Term ${payload.termName} is now active`,
        message: `The academic term "${payload.termName}" has been activated. Billing and activities for this term are now live.`,
        metadata: {
          termId: payload.termId,
          academicYearId: payload.academicYearId,
        },
      },
      { roleNames: ['Admin', 'Principal', 'Teacher'] },
    );
  }

  @OnEvent(EVENTS.TERM_STARTING_SOON)
  async onTermStartingSoon(payload: TermStartingSoonPayload) {
    await this.notifications.broadcast(
      payload.tenantId,
      {
        type: NotificationType.TERM_STARTING,
        title: `Term ${payload.termName} starts in ${payload.daysUntilStart} day(s)`,
        message: `The term "${payload.termName}" starts on ${payload.startDate.toDateString()}. Consider activating it to kick off billing.`,
        metadata: {
          termId: payload.termId,
          daysUntilStart: payload.daysUntilStart,
        },
      },
      { roleNames: ['Admin', 'Principal'] },
    );
  }

  @OnEvent(EVENTS.TERM_OVERDUE)
  async onTermOverdue(payload: TermOverduePayload) {
    await this.notifications.broadcast(
      payload.tenantId,
      {
        type: NotificationType.TERM_OVERDUE,
        title: `Term ${payload.termName} is overdue for activation`,
        message: `The term "${payload.termName}" started on ${payload.startDate.toDateString()} (${payload.daysOverdue} day(s) ago) but has not been activated yet.`,
        metadata: {
          termId: payload.termId,
          daysOverdue: payload.daysOverdue,
        },
      },
      { roleNames: ['Admin', 'Principal'] },
    );
  }

  // ─────────────────────────── BILLING
  @OnEvent(EVENTS.BILLING_GENERATED)
  async onBillingGenerated(payload: BillingGeneratedPayload) {
    await this.notifications.broadcast(
      payload.tenantId,
      {
        type: NotificationType.SYSTEM,
        title: 'Fees generated',
        message: `Billing run completed. Generated: ${payload.generated}, skipped: ${payload.skipped}.`,
        metadata: {
          feeStructureId: payload.feeStructureId,
          generated: payload.generated,
          skipped: payload.skipped,
        },
      },
      { roleNames: ['Admin', 'Principal'] },
    );
  }

  // ─────────────────────────── PAYMENTS
  @OnEvent(EVENTS.PAYMENT_RECORDED)
  async onPaymentRecorded(payload: PaymentRecordedPayload) {
    // Notify the student's user
    const student = await this.prisma.student.findUnique({
      where: { id: payload.studentId },
      include: { user: true },
    });
    if (student?.userId) {
      await this.notifications.create({
        tenantId: payload.tenantId,
        userId: student.userId,
        type: NotificationType.PAYMENT_RECEIVED,
        title: 'Payment received',
        message: `We received your payment of ${payload.amount}. Receipt: ${payload.receiptNumber}.`,
        metadata: {
          paymentId: payload.paymentId,
          studentFeeId: payload.studentFeeId,
        },
      });
    }
  }

  // ─────────────────────────── FEES
  @OnEvent(EVENTS.FEE_DUE_SOON)
  async onFeeDueSoon(payload: FeeDueSoonPayload) {
    const student = await this.prisma.student.findUnique({
      where: { id: payload.studentId },
      include: { user: true },
    });
    if (student?.userId) {
      await this.notifications.create({
        tenantId: payload.tenantId,
        userId: student.userId,
        type: NotificationType.FEE_DUE,
        title: 'Fee payment due soon',
        message: `You have an outstanding balance of ${payload.amount}. Due in ${payload.daysUntilDue} day(s) on ${payload.dueDate.toDateString()}.`,
        metadata: { studentFeeId: payload.studentFeeId },
      });
    }
  }

  @OnEvent(EVENTS.FEE_OVERDUE)
  async onFeeOverdue(payload: FeeOverduePayload) {
    const student = await this.prisma.student.findUnique({
      where: { id: payload.studentId },
      include: { user: true },
    });
    if (student?.userId) {
      await this.notifications.create({
        tenantId: payload.tenantId,
        userId: student.userId,
        type: NotificationType.FEE_OVERDUE,
        title: 'Fee payment overdue',
        message: `Your fee of ${payload.amount} was due on ${payload.dueDate.toDateString()} (${payload.daysOverdue} day(s) ago). Please settle as soon as possible.`,
        metadata: { studentFeeId: payload.studentFeeId },
      });
    }
  }

  // ─────────────────────────── ARREARS / PROMOTIONS
  @OnEvent(EVENTS.ARREARS_ROLLED_OVER)
  async onArrearsRolled(payload: ArrearsRolledOverPayload) {
    await this.notifications.broadcast(
      payload.tenantId,
      {
        type: NotificationType.ARREARS_ALERT,
        title: 'Arrears rolled over',
        message: `Arrears of ${payload.amount} were carried forward for a student.`,
        metadata: payload as any,
      },
      { roleNames: ['Admin', 'Principal'] },
    );
  }

  @OnEvent(EVENTS.STUDENT_PROMOTED)
  async onStudentPromoted(payload: StudentPromotedPayload) {
    await this.notifications.broadcast(
      payload.tenantId,
      {
        type: NotificationType.PROMOTION_READY,
        title: 'Student promotion completed',
        message: `A student was promoted for the new academic year.`,
        metadata: payload as any,
      },
      { roleNames: ['Admin', 'Principal'] },
    );
  }
}