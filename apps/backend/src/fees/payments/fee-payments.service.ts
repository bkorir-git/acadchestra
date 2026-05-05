/**
 * @file fee-payments.service.ts
 * @description Fee Payments service — record, list, void. FIFO allocation,
 *   ledger writes, receipt # generation, invoice status sync. Transactions
 *   are all-or-nothing. Void writes a REVERSAL ledger entry while the
 *   original CREDIT entry stays for audit; allocations are reversed.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  ActivityEntityType,
  InvoiceStatus,
  LedgerEntryType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { PaymentAllocatorService } from './payment-allocator.service';
import { FeeLedgerService } from '../ledger/fee-ledger.service';
import { RecordPaymentDto, VoidPaymentDto } from './dto/record-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { deriveInvoiceStatus, deriveStatus } from '../common/fee-status.util';
import { generateReceiptNumber, roundMoney } from '../common/fee-math.util';
import { FEE_EVENTS } from '../common/fee-events.constants';
import { parseOptionalDateInput } from '../common/date-input.util';

interface RequestActor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class FeePaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly allocator: PaymentAllocatorService,
    private readonly ledger: FeeLedgerService,
    private readonly events: EventEmitter2,
  ) {}

  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  private async readConfig(tenantId: string, key: string): Promise<any> {
    const c = await this.prisma.config.findFirst({
      where: { tenantId, category: 'fee', key },
    });
    return c?.value ?? null;
  }

  private async nextReceiptNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ) {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { domain: true, name: true },
    });
    const prefix =
      ((await this.readConfig(tenantId, 'receiptPrefix')) as string) ?? 'RCP';
    const code = (tenant?.domain?.split('.')[0] ?? tenant?.name ?? 'SCH')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6);
    const year = new Date().getFullYear();
    const count = await tx.feePayment.count({
      where: {
        tenantId,
        createdAt: {
          gte: new Date(`${year}-01-01T00:00:00.000Z`),
          lte: new Date(`${year}-12-31T23:59:59.999Z`),
        },
      },
    });
    return generateReceiptNumber(code, count + 1, prefix);
  }

  private async attachRecorderInfo<T extends { recordedById?: string | null }>(
    tenantId: string,
    records: T[],
  ): Promise<Array<T & { recordedByName: string | null }>> {
    const ids = Array.from(
      new Set(records.map((r) => r.recordedById).filter(Boolean) as string[]),
    );
    if (!ids.length) {
      return records.map((r) => ({ ...r, recordedByName: null }));
    }
    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameMap = new Map(
      users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
    );
    return records.map((r) => ({
      ...r,
      recordedByName: r.recordedById
        ? (nameMap.get(r.recordedById) ?? null)
        : null,
    }));
  }

  // ─── RECORD ────────────────────────────────────────────────────
  async record(dto: RecordPaymentDto, actor: RequestActor) {
    const tenantId = actor.tenantId;

    const [allowOver, allowPartial, requireRef] = await Promise.all([
      this.readConfig(tenantId, 'allowOverpayment'),
      this.readConfig(tenantId, 'allowPartialPayments'),
      this.readConfig(tenantId, 'requirePaymentReference'),
    ]);

    const createdId = await this.prisma.$transaction(async (tx) => {
      const sf = await tx.studentFee.findFirst({
        where: { id: dto.studentFeeId, tenantId },
        include: { components: true, feeStructure: true },
      });
      if (!sf) throw new NotFoundException('Student fee not found');
      if (sf.status === 'WAIVED')
        throw new BadRequestException('Cannot pay a waived fee');

      const year = await tx.academicYear.findUnique({
        where: { id: sf.feeStructure.academicYearId },
      });
      if (year?.isFinanciallyLocked)
        throw new ForbiddenException('Academic year is financially locked');
      if (sf.feeStructure.academicTermId) {
        const term = await tx.academicTerm.findUnique({
          where: { id: sf.feeStructure.academicTermId },
        });
        if (term?.isFinanciallyLocked)
          throw new ForbiddenException('Term is financially locked');
      }

      const amount = roundMoney(dto.amount);
      const outstanding = roundMoney(sf.totalAmount - sf.paidAmount);
      if (amount <= 0) throw new BadRequestException('Amount must be > 0');
      if (!allowOver && amount > outstanding + 0.01)
        throw new BadRequestException(
          `Payment ${amount} exceeds balance ${outstanding} (overpayment disabled)`,
        );
      if (allowPartial === false && amount < outstanding - 0.01)
        throw new BadRequestException(
          'Partial payments are disabled in fee config',
        );
      if (
        requireRef &&
        dto.paymentMethod !== 'CASH' &&
        !dto.transactionId &&
        !dto.referenceNumber
      ) {
        throw new BadRequestException(
          'Reference / transaction ID required for non-cash payments',
        );
      }

      if (dto.transactionId) {
        const dup = await tx.feePayment.findFirst({
          where: {
            tenantId,
            transactionId: dto.transactionId,
            status: { in: ['COMPLETED', 'PENDING'] },
          },
        });
        if (dup)
          throw new ConflictException(
            `Transaction ${dto.transactionId} already recorded`,
          );
      }

      const receiptNumber = await this.nextReceiptNumber(tx, tenantId);
      const paidAt = parseOptionalDateInput(dto.paidAt, {
        label: 'paidAt',
        defaultValue: new Date(),
      })!;

      const payment = await tx.feePayment.create({
        data: {
          receiptNumber,
          studentFeeId: sf.id,
          amount,
          paymentMethod: dto.paymentMethod,
          allocationStrategy: dto.allocationStrategy ?? 'FIFO',
          transactionId: dto.transactionId,
          referenceNumber: dto.referenceNumber,
          status: PaymentStatus.COMPLETED,
          paidAt,
          notes: dto.notes,
          recordedById: actor.id,
          tenantId,
        },
      });

      const { allocations, unallocated } = await this.allocator.allocate(
        tx,
        sf.id,
        amount,
      );
      if (allocations.length) {
        await tx.feePaymentAllocation.createMany({
          data: allocations.map((a) => ({
            feePaymentId: payment.id,
            studentFeeComponentId: a.componentId,
            amount: a.amount,
          })),
        });
      }
      const allocatedAmount = roundMoney(amount - unallocated);
      await tx.feePayment.update({
        where: { id: payment.id },
        data: {
          allocatedAmount,
          overpaymentAmount: roundMoney(unallocated),
        },
      });

      const newPaid = roundMoney(sf.paidAmount + allocatedAmount);
      const newPending = roundMoney(sf.totalAmount - newPaid);
      await tx.studentFee.update({
        where: { id: sf.id },
        data: {
          paidAmount: newPaid,
          pendingAmount: newPending,
          status: deriveStatus({
            totalAmount: sf.totalAmount,
            paidAmount: newPaid,
            dueDate: sf.dueDate,
          }),
        },
      });

      const invoice = await tx.invoice.findUnique({
        where: { studentFeeId: sf.id },
      });
      if (invoice) {
        const invoicePaid = roundMoney(invoice.paidAmount + allocatedAmount);
        const invoicePending = roundMoney(invoice.totalAmount - invoicePaid);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: invoicePaid,
            pendingAmount: invoicePending,
            status: deriveInvoiceStatus({
              totalAmount: invoice.totalAmount,
              paidAmount: invoicePaid,
              dueDate: invoice.dueDate,
            }) as InvoiceStatus,
          },
        });
      }

      await this.ledger.write(tx, {
        tenantId,
        studentId: sf.studentId,
        entryType: LedgerEntryType.CREDIT,
        amount: allocatedAmount,
        description: `Payment received: ${receiptNumber} via ${dto.paymentMethod}`,
        reference: receiptNumber,
        studentFeeId: sf.id,
        feePaymentId: payment.id,
        recordedById: actor.id,
        occurredAt: paidAt,
      });

      await this.activity.log(
        {
          action: ActivityAction.PAYMENT,
          entityType: ActivityEntityType.FEE_PAYMENT,
          entityId: payment.id,
          tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} recorded payment ${receiptNumber} of ${amount} via ${dto.paymentMethod}`,
          metadata: {
            receiptNumber,
            amount,
            allocatedAmount,
            method: dto.paymentMethod,
            studentFeeId: sf.id,
            paidAt,
          },
        },
        tx,
      );

      return payment.id;
    });

    this.events.emit(FEE_EVENTS.PAYMENT_RECORDED, {
      tenantId,
      paymentId: createdId,
    });
    return this.findOne(createdId, actor);
  }

  // ─── LIST ──────────────────────────────────────────────────────
  async findAll(query: QueryPaymentsDto, actor: RequestActor) {
    const {
      page = 1,
      limit = 10,
      search,
      studentId,
      paymentMethod,
      status,
      fromDate,
      toDate,
    } = query;
    const skip = (page - 1) * limit;

    const parsedFrom = parseOptionalDateInput(fromDate, {
      label: 'fromDate',
    });
    const parsedTo = parseOptionalDateInput(toDate, {
      label: 'toDate',
      endOfDay: true,
    });

    const where: Prisma.FeePaymentWhereInput = {
      tenantId: actor.tenantId,
      ...(paymentMethod && { paymentMethod }),
      ...(status && { status }),
      ...(studentId && { studentFee: { studentId } }),
      ...((parsedFrom || parsedTo) && {
        paidAt: {
          ...(parsedFrom && { gte: parsedFrom }),
          ...(parsedTo && { lte: parsedTo }),
        },
      }),
      ...(search && {
        OR: [
          { receiptNumber: { contains: search, mode: 'insensitive' } },
          { transactionId: { contains: search, mode: 'insensitive' } },
          { referenceNumber: { contains: search, mode: 'insensitive' } },
          {
            studentFee: {
              student: {
                OR: [
                  {
                    admissionNumber: { contains: search, mode: 'insensitive' },
                  },
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      }),
    };

    const [data, total, agg] = await Promise.all([
      this.prisma.feePayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          studentFee: {
            include: {
              student: {
                include: {
                  class: { select: { id: true, name: true } },
                },
              },
              feeStructure: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.feePayment.count({ where }),
      this.prisma.feePayment.aggregate({
        where: { ...where, status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      }),
    ]);

    const enriched = await this.attachRecorderInfo(actor.tenantId, data);

    return {
      data: enriched,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
      summary: { totalCollected: roundMoney(agg._sum.amount ?? 0) },
    };
  }

  async findOne(id: string, actor: RequestActor) {
    const p = await this.prisma.feePayment.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        studentFee: {
          include: {
            student: {
              include: { class: { include: { grade: true } }, stream: true },
            },
            feeStructure: true,
          },
        },
        allocations: { include: { studentFeeComponent: true } },
      },
    });
    if (!p) throw new NotFoundException('Payment not found');
    const [enriched] = await this.attachRecorderInfo(actor.tenantId, [p]);
    return enriched;
  }

  // ─── VOID ──────────────────────────────────────────────────────
  async voidPayment(id: string, dto: VoidPaymentDto, actor: RequestActor) {
    const tenantId = actor.tenantId;
    await this.prisma.$transaction(async (tx) => {
      const p = await tx.feePayment.findFirst({
        where: { id, tenantId },
        include: { allocations: true, studentFee: true },
      });
      if (!p) throw new NotFoundException('Payment not found');
      if (p.status !== PaymentStatus.COMPLETED)
        throw new ForbiddenException('Only completed payments can be voided');

      await this.allocator.reverse(
        tx,
        p.allocations.map((a) => ({
          studentFeeComponentId: a.studentFeeComponentId,
          amount: a.amount,
        })),
      );
      await tx.feePaymentAllocation.deleteMany({
        where: { feePaymentId: p.id },
      });

      const sf = await tx.studentFee.findUnique({
        where: { id: p.studentFeeId },
      });
      if (sf) {
        const newPaid = roundMoney(
          Math.max(0, sf.paidAmount - p.allocatedAmount),
        );
        await tx.studentFee.update({
          where: { id: sf.id },
          data: {
            paidAmount: newPaid,
            pendingAmount: roundMoney(sf.totalAmount - newPaid),
            status: deriveStatus({
              totalAmount: sf.totalAmount,
              paidAmount: newPaid,
              dueDate: sf.dueDate,
            }),
          },
        });

        const inv = await tx.invoice.findUnique({
          where: { studentFeeId: sf.id },
        });
        if (inv) {
          const newInvPaid = roundMoney(
            Math.max(0, inv.paidAmount - p.allocatedAmount),
          );
          await tx.invoice.update({
            where: { id: inv.id },
            data: {
              paidAmount: newInvPaid,
              pendingAmount: roundMoney(inv.totalAmount - newInvPaid),
              status: deriveInvoiceStatus({
                totalAmount: inv.totalAmount,
                paidAmount: newInvPaid,
                dueDate: inv.dueDate,
              }) as InvoiceStatus,
            },
          });
        }
      }

      const studentId = sf?.studentId ?? p.studentFee?.studentId;
      if (!studentId) throw new NotFoundException('Student context missing');

      await tx.feePayment.update({
        where: { id: p.id },
        data: {
          status: PaymentStatus.VOIDED,
          voidedAt: new Date(),
          voidReason: dto.reason,
          allocatedAmount: 0,
        },
      });

      await this.ledger.write(tx, {
        tenantId,
        studentId,
        entryType: LedgerEntryType.REVERSAL,
        amount: p.allocatedAmount,
        description: `Payment voided: ${p.receiptNumber}. Reason: ${dto.reason}`,
        reference: p.receiptNumber,
        feePaymentId: p.id,
        recordedById: actor.id,
      });

      await this.activity.log(
        {
          action: ActivityAction.STATUS_CHANGE,
          entityType: ActivityEntityType.FEE_PAYMENT,
          entityId: p.id,
          tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} voided payment ${p.receiptNumber}`,
          metadata: { reason: dto.reason, amount: p.amount },
        },
        tx,
      );
    });

    this.events.emit(FEE_EVENTS.PAYMENT_VOIDED, {
      tenantId,
      paymentId: id,
      reason: dto.reason,
    });
    return this.findOne(id, actor);
  }
}
