/**
 * @file promotion-plan.dto.ts
 * @description DTOs for the 3-step promotion policy engine:
 *     STEP 1 — PLAN (generate a dry-run plan with mappings/warnings/conflicts)
 *     STEP 2 — REVIEW (admin overrides individual entries)
 *     STEP 3 — EXECUTE (commits approved plan into StudentPromotion + history)
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export type PromotionStrategyValue =
  | 'PRESERVE_STREAM'
  | 'BALANCED_DISTRIBUTION'
  | 'CUSTOM_MAPPING'
  | 'GRADE_ONLY';

export class CreatePromotionPlanDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Year being closed' })
  @IsString()
  fromAcademicYearId!: string;

  @ApiProperty({ description: 'Incoming year' })
  @IsString()
  toAcademicYearId!: string;

  @ApiPropertyOptional({
    enum: [
      'PRESERVE_STREAM',
      'BALANCED_DISTRIBUTION',
      'CUSTOM_MAPPING',
      'GRADE_ONLY',
    ],
    default: 'PRESERVE_STREAM',
  })
  @IsOptional()
  @IsIn([
    'PRESERVE_STREAM',
    'BALANCED_DISTRIBUTION',
    'CUSTOM_MAPPING',
    'GRADE_ONLY',
  ])
  strategy?: PromotionStrategyValue;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeStudentIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdatePlanEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  overrideClassId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  overrideStream?: string | null;

  @ApiPropertyOptional({
    enum: ['PROMOTE', 'RETAIN', 'GRADUATE', 'SKIP'],
  })
  @IsOptional()
  @IsIn(['PROMOTE', 'RETAIN', 'GRADUATE', 'SKIP'])
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNotes?: string;
}

export class ApprovePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ExecutePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
