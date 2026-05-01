/**
 * @file fee-structure-versions.service.ts
 * @description Versioning for FeeStructure. Every edit on a locked or
 *   already-billed structure creates a snapshot in FeeStructureVersion so
 *   the historical shape is preserved forever and can be diff'd in the UI.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FeeStructureVersionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Snapshot current state of a structure into FeeStructureVersion. */
  async snapshotVersion(
    tx: Prisma.TransactionClient,
    structureId: string,
    tenantId: string,
    userId: string,
    changeReason?: string,
  ) {
    const structure = await tx.feeStructure.findUnique({
      where: { id: structureId },
      include: {
        feeComponents: { orderBy: { sortOrder: 'asc' } },
        levels: {
          include: { components: { orderBy: { sortOrder: 'asc' } } },
        },
        academicYear: { select: { id: true, name: true } },
        academicTerm: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
        stream: { select: { id: true, name: true } },
        curriculum: { select: { id: true, name: true } },
      },
    });
    if (!structure) throw new NotFoundException('Structure not found');

    // Close out previous active version
    await tx.feeStructureVersion.updateMany({
      where: { feeStructureId: structureId, isActive: true },
      data: { isActive: false, effectiveTo: new Date() },
    });

    const last = await tx.feeStructureVersion.findFirst({
      where: { feeStructureId: structureId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    return tx.feeStructureVersion.create({
      data: {
        feeStructureId: structureId,
        tenantId,
        version: nextVersion,
        effectiveFrom: new Date(),
        isActive: true,
        snapshot: structure as unknown as Prisma.InputJsonValue,
        changeReason: changeReason ?? null,
        createdById: userId,
      },
    });
  }

  async list(structureId: string, tenantId: string) {
    return this.prisma.feeStructureVersion.findMany({
      where: { feeStructureId: structureId, tenantId },
      orderBy: { version: 'desc' },
    });
  }

  async get(versionId: string, tenantId: string) {
    const v = await this.prisma.feeStructureVersion.findFirst({
      where: { id: versionId, tenantId },
    });
    if (!v) throw new NotFoundException('Version not found');
    return v;
  }
}