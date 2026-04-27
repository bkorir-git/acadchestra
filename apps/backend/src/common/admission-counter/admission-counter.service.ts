/**
 * @file admission-counter.service.ts
 * @module common/admission-counter
 * @description Race-safe sequential admission number issuance per tenant.
 *
 *   Why a dedicated table?
 *     - Two simultaneous admissions could SELECT max() then INSERT the same
 *       value → unique constraint violation.
 *     - Solution: lock the counter row with SELECT ... FOR UPDATE, increment,
 *       commit. Postgres serializes the locked transactions so the next
 *       waiter sees the post-increment value.
 *
 *   Strategies:
 *     - SEQUENTIAL          → "0001"
 *     - YEAR_PREFIXED       → "20260001"  (yearPrefix is auto-set on init)
 *     - CUSTOM_PREFIXED     → "GW0001"
 *
 *   Public API:
 *     - ensure(tenantId, init?)        → idempotent counter creation
 *     - issueNext(tenantId, opts?)     → atomically allocate next number
 *     - peekNext(tenantId)             → preview next number WITHOUT locking
 *     - update(tenantId, dto)          → change strategy / prefix / padding
 *     - rebaseFromExisting(tenantId)   → seed from highest existing student
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AdmissionStrategy, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '../config/config.service';

interface InitOptions {
  prefix?: string;
  yearPrefix?: string;
  paddingLength?: number;
  strategy?: AdmissionStrategy;
  startAt?: number;
}

interface UpdateOptions extends InitOptions {}

@Injectable()
export class AdmissionCounterService {
  private readonly logger = new Logger(AdmissionCounterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ──────────────────────────────────────────────── ENSURE
  /** Create the counter for a tenant if missing. Reads defaults from Config. */
  async ensure(
    tenantId: string,
    init?: InitOptions,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const existing = await client.admissionCounter.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;

    const strategy =
      init?.strategy ??
      ((await this.config.getString(
        tenantId,
        'student',
        'admissionNumberStrategy',
        'YEAR_PREFIXED',
      )) as AdmissionStrategy);
    const prefix =
      init?.prefix ??
      (await this.config.getString(
        tenantId,
        'student',
        'admissionNumberPrefix',
        '',
      ));
    const paddingLength =
      init?.paddingLength ??
      (await this.config.getNumber(
        tenantId,
        'student',
        'admissionNumberPadding',
        4,
      ));
    const yearPrefix =
      init?.yearPrefix ??
      (strategy === AdmissionStrategy.YEAR_PREFIXED
        ? String(new Date().getFullYear())
        : undefined);

    return client.admissionCounter.create({
      data: {
        tenantId,
        strategy,
        prefix,
        paddingLength,
        yearPrefix: yearPrefix ?? null,
        currentSequence: init?.startAt ?? 0,
      },
    });
  }

  // ──────────────────────────────────────────────── PEEK
  /** Compute what the NEXT admission number would be, WITHOUT incrementing. */
  async peekNext(tenantId: string): Promise<string> {
    const counter = await this.prisma.admissionCounter.findUnique({
      where: { tenantId },
    });
    if (!counter) {
      // Auto-init on first peek so the UI can preview safely
      const created = await this.ensure(tenantId);
      return this.format(created.currentSequence + 1, created);
    }
    return this.format(counter.currentSequence + 1, counter);
  }

  // ──────────────────────────────────────────────── ISSUE (race-safe)
  /**
   * Allocate the next admission number atomically.
   * MUST be called from inside a $transaction if you need to roll back
   * the issuance on later failure. Otherwise the number is consumed forever.
   *
   * Returns the formatted admissionNumber.
   */
  async issueNext(
    tenantId: string,
    opts?: { tx?: Prisma.TransactionClient; year?: number },
  ): Promise<string> {
    const tx = opts?.tx ?? this.prisma;

    // Use $queryRaw for the SELECT FOR UPDATE — Prisma doesn't expose locks natively
    const locked = await tx.$queryRaw<
      Array<{
        id: string;
        prefix: string;
        yearPrefix: string | null;
        currentSequence: number;
        paddingLength: number;
        strategy: AdmissionStrategy;
      }>
    >`
      SELECT id, prefix, "yearPrefix", "currentSequence", "paddingLength", strategy
      FROM admission_counters
      WHERE "tenantId" = ${tenantId}
      FOR UPDATE
    `;

    if (!locked.length) {
      // Auto-init if the tenant somehow doesn't have one yet.
      // Note: outside the lock, but since no one else has issued yet,
      // there's no race here.
      await this.ensure(tenantId);
      return this.issueNext(tenantId, opts);
    }

    const counter = locked[0];
    const nextSeq = counter.currentSequence + 1;
    const yearPrefix =
      counter.strategy === AdmissionStrategy.YEAR_PREFIXED
        ? (counter.yearPrefix ?? String(opts?.year ?? new Date().getFullYear()))
        : counter.yearPrefix;

    const admissionNumber = this.format(nextSeq, {
      ...counter,
      yearPrefix,
    });

    await tx.admissionCounter.update({
      where: { id: counter.id },
      data: {
        currentSequence: nextSeq,
        lastIssuedAt: new Date(),
        yearPrefix: yearPrefix ?? null,
      },
    });

    return admissionNumber;
  }

  // ──────────────────────────────────────────────── UPDATE config
  /** Change strategy / prefix / padding. Forbids decreasing currentSequence. */
  async update(tenantId: string, dto: UpdateOptions) {
    const counter = await this.prisma.admissionCounter.findUnique({
      where: { tenantId },
    });
    if (!counter) throw new NotFoundException('Counter not initialized');

    if (dto.startAt !== undefined && dto.startAt < counter.currentSequence) {
      throw new BadRequestException(
        `startAt cannot be lower than currentSequence (${counter.currentSequence})`,
      );
    }

    return this.prisma.admissionCounter.update({
      where: { id: counter.id },
      data: {
        strategy: dto.strategy ?? undefined,
        prefix: dto.prefix ?? undefined,
        yearPrefix: dto.yearPrefix ?? undefined,
        paddingLength: dto.paddingLength ?? undefined,
        currentSequence: dto.startAt ?? undefined,
      },
    });
  }

  // ──────────────────────────────────────────────── MIGRATION HELPER
  /**
   * Seed the counter from existing students. Useful when migrating from
   * a legacy schema where students were created without a counter.
   * Picks the highest trailing-digit run from existing admissionNumbers.
   */
  async rebaseFromExisting(tenantId: string) {
    const students = await this.prisma.student.findMany({
      where: { tenantId },
      select: { admissionNumber: true },
    });
    let max = 0;
    for (const s of students) {
      const m = s.admissionNumber.match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
    const counter = await this.ensure(tenantId);
    if (max > counter.currentSequence) {
      return this.prisma.admissionCounter.update({
        where: { id: counter.id },
        data: { currentSequence: max },
      });
    }
    return counter;
  }

  // ──────────────────────────────────────────────── FORMAT
  private format(
    sequence: number,
    counter: {
      prefix: string;
      yearPrefix: string | null;
      paddingLength: number;
      strategy: AdmissionStrategy;
    },
  ): string {
    const padded = String(sequence).padStart(counter.paddingLength, '0');
    switch (counter.strategy) {
      case AdmissionStrategy.YEAR_PREFIXED:
        return `${counter.yearPrefix ?? new Date().getFullYear()}${padded}`;
      case AdmissionStrategy.CUSTOM_PREFIXED:
        return `${counter.prefix}${padded}`;
      case AdmissionStrategy.SEQUENTIAL:
      default:
        return padded;
    }
  }
}
