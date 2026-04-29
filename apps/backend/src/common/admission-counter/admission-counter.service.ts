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

interface LiveFormatOptions {
  strategy: AdmissionStrategy;
  prefix: string;
  yearPrefix: string | null;
  paddingLength: number;
}

interface InitOptions {
  prefix?: string;
  yearPrefix?: string;
  paddingLength?: number;
  strategy?: AdmissionStrategy;
  startAt?: number;
}

@Injectable()
export class AdmissionCounterService {
  private readonly logger = new Logger(AdmissionCounterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async getLiveFormatOptions(
    tenantId: string,
  ): Promise<LiveFormatOptions> {
    const cfg = await this.config.getCategory<{
      admissionNumberStrategy?: string;
      admissionNumberPrefix?: string;
      admissionNumberPadding?: number;
    }>(tenantId, 'student');

    const strategy = (cfg.admissionNumberStrategy ??
      'YEAR_PREFIXED') as AdmissionStrategy;
    const prefix = cfg.admissionNumberPrefix ?? '';
    const padding = cfg.admissionNumberPadding ?? 4;
    const yearPrefix =
      strategy === AdmissionStrategy.YEAR_PREFIXED
        ? String(new Date().getFullYear())
        : null;

    return { strategy, prefix, yearPrefix, paddingLength: padding };
  }

  // ─── ENSURE
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

    const live = await this.getLiveFormatOptions(tenantId);
    return client.admissionCounter.create({
      data: {
        tenantId,
        strategy: init?.strategy ?? live.strategy,
        prefix: init?.prefix ?? live.prefix,
        paddingLength: init?.paddingLength ?? live.paddingLength,
        yearPrefix: init?.yearPrefix ?? live.yearPrefix,
        currentSequence: init?.startAt ?? 0,
      },
    });
  }

  // ──────────────────────────────────────────────── PEEK
  /** Compute what the NEXT admission number would be, WITHOUT incrementing. */
  async peekNext(tenantId: string): Promise<string> {
    let counter = await this.prisma.admissionCounter.findUnique({
      where: { tenantId },
    });
    if (!counter) counter = await this.ensure(tenantId);

    const live = await this.getLiveFormatOptions(tenantId);
    return this.format(counter.currentSequence + 1, live);
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
    opts?: { tx?: Prisma.TransactionClient },
  ): Promise<string> {
    const tx = opts?.tx ?? this.prisma;

    const locked = await tx.$queryRaw<
      Array<{ id: string; currentSequence: number }>
    >`
      SELECT id, "currentSequence"
      FROM admission_counters
      WHERE "tenantId" = ${tenantId}
      FOR UPDATE
    `;

    if (!locked.length) {
      await this.ensure(tenantId);
      return this.issueNext(tenantId, opts);
    }

    const { id, currentSequence } = locked[0];
    const nextSeq = currentSequence + 1;
    const live = await this.getLiveFormatOptions(tenantId);
    const admissionNumber = this.format(nextSeq, live);

    await tx.admissionCounter.update({
      where: { id },
      data: {
        currentSequence: nextSeq,
        lastIssuedAt: new Date(),
        // Keep the counter row in sync for backwards-compat reads,
        // but the FORMAT call above already used live values.
        strategy: live.strategy,
        prefix: live.prefix,
        yearPrefix: live.yearPrefix,
        paddingLength: live.paddingLength,
      },
    });

    return admissionNumber;
  }

  // ─── UPDATE (manual override — bumps sequence only)
  async update(tenantId: string, dto: InitOptions) {
    const counter = await this.prisma.admissionCounter.findUnique({
      where: { tenantId },
    });
    if (!counter) throw new NotFoundException('Counter not initialized');

    if (dto.startAt !== undefined && dto.startAt < counter.currentSequence) {
      throw new BadRequestException(
        `startAt cannot be lower than currentSequence (${counter.currentSequence})`,
      );
    }

    // We also write to Config so the Settings UI stays consistent.
    const writes: Promise<unknown>[] = [];
    if (dto.strategy)
      writes.push(
        this.config.set(
          tenantId,
          'student',
          'admissionNumberStrategy',
          dto.strategy,
        ),
      );
    if (dto.prefix !== undefined)
      writes.push(
        this.config.set(
          tenantId,
          'student',
          'admissionNumberPrefix',
          dto.prefix,
        ),
      );
    if (dto.paddingLength !== undefined)
      writes.push(
        this.config.set(
          tenantId,
          'student',
          'admissionNumberPadding',
          dto.paddingLength,
        ),
      );
    await Promise.all(writes);

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

  private format(sequence: number, opts: LiveFormatOptions): string {
    const padded = String(sequence).padStart(opts.paddingLength, '0');
    switch (opts.strategy) {
      case AdmissionStrategy.YEAR_PREFIXED:
        return `${opts.yearPrefix ?? new Date().getFullYear()}${padded}`;
      case AdmissionStrategy.CUSTOM_PREFIXED:
        return `${opts.prefix}${padded}`;
      case AdmissionStrategy.SEQUENTIAL:
      default:
        return padded;
    }
  }
}
