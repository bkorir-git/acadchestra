/**
 * @file arrears-query.dto.ts
 * @description Filters for the arrears listing endpoint plus the
 *   roll-forward operation. Filters are AND-combined and tenant-scoped at
 *   the service layer.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { FeeCategory, FeeStatus } from '@prisma/client';

export class ArrearsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 25;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  academicTermId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  streamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gradeId?: string;

  @ApiPropertyOptional({ enum: FeeCategory })
  @IsOptional()
  @IsEnum(FeeCategory)
  category?: FeeCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minDaysOverdue?: number;

  @ApiPropertyOptional({
    enum: FeeStatus,
    description: 'PENDING | PARTIAL | OVERDUE',
  })
  @IsOptional()
  @IsIn(['PENDING', 'PARTIAL', 'OVERDUE'])
  status?: FeeStatus;
}

export class RollForwardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromTermId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toTermId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
