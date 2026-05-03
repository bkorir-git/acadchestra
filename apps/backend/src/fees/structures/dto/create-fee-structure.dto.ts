/**
 * @file create-fee-structure.dto.ts
 * @description Payload for creating a fee structure (advanced mode). The
 *   `scope` field decides whether `levels[]` (school-wide) or `components[]`
 *   (specific scopes) is required. Validation enforces those rules.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { FeeCategory, FeeStructureScope, FeeType } from '@prisma/client';

export class FeeComponentDto {
  @ApiProperty({ example: 'Tuition' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 25000 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ default: 'KES' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isCompulsory?: boolean;

  @ApiPropertyOptional({ enum: FeeCategory, default: FeeCategory.ACADEMIC })
  @IsOptional()
  @IsEnum(FeeCategory)
  category?: FeeCategory;

  @ApiPropertyOptional({ description: 'Custom FeeCategoryEntity id' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lateFee?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  priority?: number;
}

export class FeeLevelDto {
  @ApiPropertyOptional({ description: 'Level keyed by class' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ description: 'Level keyed by grade' })
  @IsOptional()
  @IsString()
  gradeId?: string;

  @ApiProperty({ example: 'Grade 4' })
  @IsString()
  @IsNotEmpty()
  levelLabel!: string;

  @ApiProperty({ type: [FeeComponentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeeComponentDto)
  components!: FeeComponentDto[];
}

export class CreateFeeStructureDto {
  @ApiProperty({ example: '2026 Term 1 Fees' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: FeeType, default: FeeType.TERM_WISE })
  @IsOptional()
  @IsEnum(FeeType)
  feeType?: FeeType;

  @ApiPropertyOptional({
    enum: FeeStructureScope,
    default: FeeStructureScope.SCHOOL_WIDE,
  })
  @IsOptional()
  @IsEnum(FeeStructureScope)
  scope?: FeeStructureScope;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isAutoBill?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  academicTermId?: string;

  // ─── Scope targets (most-specific wins) ──────────────────────
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

  // ─── Components / levels ─────────────────────────────────────
  @ApiPropertyOptional({ type: [FeeComponentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeeComponentDto)
  components?: FeeComponentDto[];

  @ApiPropertyOptional({ type: [FeeLevelDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeeLevelDto)
  levels?: FeeLevelDto[];
}
