/**
 * @description Query DTO for tenant-scoped and global activity feed filtering.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ActivityAction, ActivityEntityType } from '@prisma/client';

export class QueryActivityDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ActivityAction })
  @IsOptional()
  @IsEnum(ActivityAction)
  action?: ActivityAction;

  @ApiPropertyOptional({ enum: ActivityEntityType })
  @IsOptional()
  @IsEnum(ActivityEntityType)
  entityType?: ActivityEntityType;

  @ApiPropertyOptional({ example: 'cmf2abc123xyz0001k9lmno45' })
  @IsOptional()
  @IsString()
  @Matches(/^c[\w]{8,}$/i, { message: 'tenantId must be a valid CUID' })
  tenantId?: string;

  @ApiPropertyOptional({ example: 'cmf2abc123xyz0001k9lmno45' })
  @IsOptional()
  @IsString()
  @Matches(/^c[\w]{8,}$/i, { message: 'userId must be a valid CUID' })
  userId?: string;

  @ApiPropertyOptional({ example: 'student admitted' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
