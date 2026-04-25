/**
 * @service BulkOperationsService
 * @description Fan-out for non-promotion bulk ops. Bulk promotion moved
 *   to the Promotion Plan engine.
 */
import { Injectable } from '@nestjs/common';
import { ActivityAction, ActivityEntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ActivityService } from '../common/activity/activity.service';
import { BulkStatusUpdateDto } from './dto/bulk-operations.dto';
import { RequestActor } from '../academic/academic-terms/academic-terms.service';

export interface BulkResult {
  total: number;
  updated: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

@Injectable()
export class BulkOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  async bulkStatusUpdate(
    dto: BulkStatusUpdateDto,
    actor: RequestActor,
  ): Promise<BulkResult> {
    const result: BulkResult = {
      total: dto.studentIds.length,
      updated: 0,
      failed: 0,
      errors: [],
    };

    for (const id of dto.studentIds) {
      try {
        await this.prisma.student.update({
          where: { id },
          data: { academicStatus: dto.status },
        });
        result.updated++;
      } catch (e: any) {
        result.failed++;
        result.errors.push({ id, error: e.message });
      }
    }

    await this.activityService.log({
      action: ActivityAction.STATUS_CHANGE,
      entityType: ActivityEntityType.STUDENT,
      entityId: 'bulk',
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `Bulk status update → ${dto.status}: ${result.updated} success, ${result.failed} failed`,
      metadata: {
        status: dto.status,
        reason: dto.reason,
        count: dto.studentIds.length,
      } as Prisma.InputJsonValue,
    });
    return result;
  }
}
