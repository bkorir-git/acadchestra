/**
 * @file query-fee-structures.dto.ts
 * @description Pagination + filter parameters for the structures listing
 *   endpoint. Filters are AND-combined; `search` matches name/description.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { FeeStructureScope, FeeType } from '@prisma/client';

export class QueryFeeStructuresDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 10;

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
  curriculumId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gradeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  streamId?: string;

  @ApiPropertyOptional({ enum: FeeStructureScope })
  @IsOptional()
  @IsEnum(FeeStructureScope)
  scope?: FeeStructureScope;

  @ApiPropertyOptional({ enum: FeeType })
  @IsOptional()
  @IsEnum(FeeType)
  feeType?: FeeType;

  @ApiPropertyOptional({ description: 'true|false string' })
  @IsOptional()
  @IsString()
  isLocked?: string;
}
