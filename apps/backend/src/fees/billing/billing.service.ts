/**
 * @file billing.service.ts
 * @description Billing engine — preview + execute. Preview is read-only;
 *   execute creates StudentFee + components + Invoice + ledger DEBIT in a
 *   single transaction, idempotent per (student, structure). Auto-locks
 *   used structures so their snapshot stays stable.
 *
 *   Invariants:
 *     - Never bills inactive students.
 *     - Never bills in archived years or financially-locked terms.
 *     - Ledger DEBIT written BEFORE aggregate updates.
 *     - Optional arrears carry-forward across terms.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  ActivityEntityType,
  InvoiceStatus,
  LedgerEntryType,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { FeeLedgerService } from '../ledger/fee-ledger.service';
import { FeeStructureResolverService } from '../structures/fee-structure-resolver.service';
import {
  ExecuteBillingDto,
  PreviewBillingDto,
} from './dto/preview-billing.dto';
import { deriveStatus } from '../common/fee-status.util';
import { generateInvoiceNumber, roundMoney } from '../common/fee-math.util';
import { FEE_EVENTS } from '../common/fee-events.constants';
import { resolveStructureForStudent } from '../common/fee-scope.util';

interface RequestActor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
}

export interface PreviewEntry {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  gradeName: string;
  streamName?: string | null;
  resolution: {
    structureId: string;
    structureName: string;
    levelId: string | null;
    levelLabel: string | null;
    totalAmount: number;
    reason: string;
  } | null;
  arrearsCarryForward: number;
  totalToBill: number;
  alreadyBilled: boolean;
  skipReason?: string;
}

export interface PreviewResult {
  academicYearId: string;
  academicYearName: string;
  academicTermId?: string | null;
  academicTermName?: string | null;
  totalStudents: number;
  eligible: number;
  skipped: number;
  alreadyBilled: number;
  totalAmount: number;
  entries: PreviewEntry[];
}

export interface ExecuteResult {
  billed: number;
  skipped: number;
  alreadyBilled: number;
  totalAmount: number;
  ledgerEntries: number;
  invoicesIssued: number;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly ledger: FeeLedgerService,
    private readonly resolver: FeeStructureResolverService,
    private readonly events: EventEmitter2,
  ) {}

  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  // ─── PREVIEW ────────────────────────────────────────────────────
  async preview(
    dto: PreviewBillingDto,
    actor: RequestActor,
  ): Promise<PreviewResult> {
    const { year, term, students, structures } = await this.loadContext(
      actor.tenantId,
      dto,
    );

    const alreadyBilledSet = await this.loadAlreadyBilledSet(
      actor.tenantId,
      students.map((s) => s.id),
      structures.map((s) => s.id),
    );

    const entries: PreviewEntry[] = [];
    let eligible = 0,
      skipped = 0,
      alreadyBilled = 0,
      totalAmount = 0;

    for (const stu of students) {
      const resolution = this.resolver['resolveAgainstStructures']
        ? null
        : null;
      const res = resolveStructureForStudent(
        {
          id: stu.id,
          classId: stu.classId,
          streamId: stu.streamId,
          gradeId: stu.class.gradeId,
          curriculumId: stu.class.grade.curriculumId,
        },
        structures,
      );

      const base = {
        studentId: stu.id,
        studentName: `${stu.firstName} ${stu.lastName}`,
        admissionNumber: stu.admissionNumber,
        className: stu.class.name,
        gradeName: stu.class.grade.name,
        streamName: stu.stream?.name ?? null,
        arrearsCarryForward: 0,
      };

      if (!res) {
        skipped++;
        entries.push({
          ...base,
          resolution: null,
          totalToBill: 0,
          alreadyBilled: false,
          skipReason: 'No structure matches this student',
        });
        continue;
      }

      const key = `${stu.id}:${res.structureId}`;
      if (alreadyBilledSet.has(key)) {
        alreadyBilled++;
        entries.push({
          ...base,
          resolution: {
            structureId: res.structureId,
            structureName: res.structureName,
            levelId: res.levelId,
            levelLabel: res.levelLabel,
            totalAmount: res.totalAmount,
            reason: res.reason,
          },
          totalToBill: 0,
          alreadyBilled: true,
          skipReason: 'Already billed for this structure',
        });
        continue;
      }
      eligible++;
      totalAmount += res.totalAmount;
      entries.push({
        ...base,
        resolution: {
          structureId: res.structureId,
          structureName: res.structureName,
          levelId: res.levelId,
          levelLabel: res.levelLabel,
          totalAmount: res.totalAmount,
          reason: res.reason,
        },
        totalToBill: res.totalAmount,
        alreadyBilled: false,
      });
    }

    this.events.emit(FEE_EVENTS.BILLING_PREVIEWED, {
      tenantId: actor.tenantId,
      summary: { eligible, skipped, alreadyBilled, totalAmount },
    });

    return {
      academicYearId: year.id,
      academicYearName: year.name,
      academicTermId: term?.id ?? null,
      academicTermName: term?.name ?? null,
      totalStudents: students.length,
      eligible,
      skipped,
      alreadyBilled,
      totalAmount: roundMoney(totalAmount),
      entries,
    };
  }

  // ─── EXECUTE ────────────────────────────────────────────────────
  async execute(
    dto: ExecuteBillingDto,
    actor: RequestActor,
  ): Promise<ExecuteResult> {
    const tenantId = actor.tenantId;
    const { year, term, students, structures } = await this.loadContext(
      tenantId,
      dto,
    );

    if (!structures.length)
      throw new BadRequestException('No eligible fee structures found');
    if (!students.length)
      throw new BadRequestException('No eligible students found');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { domain: true, name: true },
    });
    const invoicePrefix =
      (await this.readConfig(tenantId, 'invoicePrefix')) ?? 'INV';
    const tenantCode = (tenant?.domain?.split('.')[0] ?? tenant?.name ?? 'SCH')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6);

    const issuedInvoiceIds: string[] = [];

    const result = await this.prisma.$transaction(
      async (tx) => {
        let billed = 0,
          skipped = 0,
          alreadyBilled = 0,
          totalAmount = 0,
          ledgerEntries = 0,
          invoicesIssued = 0;

        const yearStart = new Date(`${new Date().getFullYear()}-01-01`);
        let invoiceSeq = await tx.invoice.count({
          where: { tenantId, createdAt: { gte: yearStart } },
        });

        for (const stu of students) {
          const resolution = resolveStructureForStudent(
            {
              id: stu.id,
              classId: stu.classId,
              streamId: stu.streamId,
              gradeId: stu.class.gradeId,
              curriculumId: stu.class.grade.curriculumId,
            },
            structures,
          );
          if (!resolution) {
            skipped++;
            continue;
          }

          const existing = await tx.studentFee.findUnique({
            where: {
              studentId_feeStructureId: {
                studentId: stu.id,
                feeStructureId: resolution.structureId,
              },
            },
          });
          if (existing) {
            alreadyBilled++;
            continue;
          }

          let previousBalance = 0;
          if (dto.carryForwardArrears) {
            const bal = await this.ledger.getStudentBalance(
              tx,
              tenantId,
              stu.id,
            );
            if (bal > 0) previousBalance = bal;
          }

          const earliestDue = resolution.components
            .map((c) => c.dueDate)
            .filter((d): d is Date => !!d)
            .sort((a, b) => a.getTime() - b.getTime())[0];

          const totalForStudent = roundMoney(resolution.totalAmount);

          const sf = await tx.studentFee.create({
            data: {
              studentId: stu.id,
              feeStructureId: resolution.structureId,
              tenantId,
              totalAmount: totalForStudent,
              paidAmount: 0,
              pendingAmount: totalForStudent,
              previousBalance,
              isArrears: previousBalance > 0,
              dueDate: earliestDue ?? null,
              status: deriveStatus({
                totalAmount: totalForStudent,
                paidAmount: 0,
                dueDate: earliestDue,
              }),
              components: {
                create: resolution.components.map((c) => ({
                  feeComponentId: resolution.levelId ? null : c.id,
                  feeLevelComponentId: resolution.levelId ? c.id : null,
                  name: c.name,
                  amount: c.amount,
                  sortOrder: c.sortOrder,
                  priority: c.priority ?? 100,
                  dueDate: c.dueDate ?? null,
                  status: deriveStatus({
                    totalAmount: c.amount,
                    paidAmount: 0,
                    dueDate: c.dueDate,
                  }),
                })),
              },
            },
          });

          invoiceSeq++;
          const invoiceNumber = generateInvoiceNumber(
            tenantCode,
            invoiceSeq,
            invoicePrefix,
          );
          const inv = await tx.invoice.create({
            data: {
              invoiceNumber,
              tenantId,
              studentId: stu.id,
              academicYearId: year.id,
              academicTermId: term?.id ?? null,
              feeStructureId: resolution.structureId,
              studentFeeId: sf.id,
              subtotal: totalForStudent,
              discountAmount: 0,
              totalAmount: totalForStudent,
              paidAmount: 0,
              pendingAmount: totalForStudent,
              dueDate: earliestDue,
              status: InvoiceStatus.ISSUED,
              issueDate: new Date(),
              notes:
                `Auto-billed: ${resolution.structureName}` +
                (resolution.levelLabel ? ` — ${resolution.levelLabel}` : ''),
            },
          });
          issuedInvoiceIds.push(inv.id);
          invoicesIssued++;

          await this.ledger.write(tx, {
            tenantId,
            studentId: stu.id,
            entryType: LedgerEntryType.DEBIT,
            amount: totalForStudent,
            description: `Fee charged: ${resolution.structureName}${
              resolution.levelLabel ? ` — ${resolution.levelLabel}` : ''
            }`,
            reference: invoiceNumber,
            studentFeeId: sf.id,
            recordedById: actor.id,
            metadata: {
              structureId: resolution.structureId,
              levelId: resolution.levelId,
              termId: term?.id ?? null,
              yearId: year.id,
            },
          });
          ledgerEntries++;
          billed++;
          totalAmount += totalForStudent;
        }

        // Auto-lock structures used in this run
        const usedStructureIds = [...new Set(structures.map((s) => s.id))];
        await tx.feeStructure.updateMany({
          where: { id: { in: usedStructureIds }, isLocked: false, tenantId },
          data: {
            isLocked: true,
            lockedAt: new Date(),
            lockedReason: 'Student fees generated',
          },
        });

        await this.activity.log(
          {
            action: ActivityAction.BILLING,
            entityType: ActivityEntityType.STUDENT_FEE,
            entityId: year.id,
            tenantId,
            userId: actor.id,
            message: `${this.actorName(actor)} ran billing: ${billed} billed, ${alreadyBilled} already billed, ${skipped} skipped`,
            metadata: {
              yearId: year.id,
              termId: term?.id,
              totalAmount: roundMoney(totalAmount),
              billed,
              skipped,
              alreadyBilled,
              note: dto.note,
            },
          },
          tx,
        );

        return {
          billed,
          skipped,
          alreadyBilled,
          totalAmount: roundMoney(totalAmount),
          ledgerEntries,
          invoicesIssued,
        };
      },
      { timeout: 180_000 },
    );

    this.events.emit(FEE_EVENTS.BILLING_EXECUTED, {
      tenantId,
      summary: result,
      invoiceIds: issuedInvoiceIds,
    });
    for (const id of issuedInvoiceIds) {
      this.events.emit(FEE_EVENTS.INVOICE_ISSUED, { tenantId, invoiceId: id });
    }
    return result;
  }

  // ─── HELPERS ────────────────────────────────────────────────────
  private async readConfig(
    tenantId: string,
    key: string,
  ): Promise<string | null> {
    const c = await this.prisma.config.findFirst({
      where: { tenantId, category: 'fee', key },
    });
    return c ? String(c.value) : null;
  }

  private async loadContext(tenantId: string, dto: PreviewBillingDto) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: dto.academicYearId, tenantId },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    if (year.status === 'ARCHIVED')
      throw new BadRequestException('Cannot bill an archived year');
    if (year.isFinanciallyLocked)
      throw new ForbiddenException('Year is financially locked');

    let term = null as any;
    if (dto.academicTermId) {
      term = await this.prisma.academicTerm.findFirst({
        where: { id: dto.academicTermId, tenantId, academicYearId: year.id },
      });
      if (!term) throw new NotFoundException('Term not found in this year');
      if (term.isFinanciallyLocked)
        throw new ForbiddenException('Term is financially locked');
      if (!term.hasFees)
        throw new BadRequestException('Term is not configured for fees');
    }

    const structures = await this.resolver.loadStructures(
      tenantId,
      year.id,
      term?.id ?? null,
      dto.feeStructureId,
    );

    this.logger.debug(`loadStructures returned ${structures.length} structures`, 
  JSON.stringify(structures.map(s => ({ id: s.id, name: s.name, termId: s.academicTermId, gradeId: s.gradeId, scope: s.scope }))));

    const studentRows = await this.prisma.student.findMany({
      where: {
        tenantId,
        academicStatus: 'ACTIVE',
        class: { academicYearId: year.id },
        ...(dto.studentIds?.length && { id: { in: dto.studentIds } }),
        ...(dto.classIds?.length && { classId: { in: dto.classIds } }),
        ...(dto.streamIds?.length && { streamId: { in: dto.streamIds } }),
        ...(dto.gradeIds?.length && {
          class: {
            academicYearId: year.id,
            gradeId: { in: dto.gradeIds },
          },
        }),
      },
      select: {
        id: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
        classId: true,
        streamId: true,
        class: {
          select: {
            id: true,
            name: true,
            gradeId: true,
            grade: {
              select: { id: true, name: true, curriculumId: true },
            },
          },
        },
        stream: { select: { id: true, name: true } },
      },
    });

    return { year, term, students: studentRows, structures };
  }

  private async loadAlreadyBilledSet(
    tenantId: string,
    studentIds: string[],
    structureIds: string[],
  ) {
    if (!studentIds.length || !structureIds.length) return new Set<string>();
    const rows = await this.prisma.studentFee.findMany({
      where: {
        tenantId,
        studentId: { in: studentIds },
        feeStructureId: { in: structureIds },
      },
      select: { studentId: true, feeStructureId: true },
    });
    return new Set(rows.map((r) => `${r.studentId}:${r.feeStructureId}`));
  }
}
