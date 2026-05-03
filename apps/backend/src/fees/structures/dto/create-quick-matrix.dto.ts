/**
 * @file create-quick-matrix.dto.ts
 * @description Curriculum-driven "matrix" creator. The user picks a
 *   curriculum, the year, the terms (e.g. T1/T2/T3 of CBC) and rows,
 *   then enters tuition + extras per row × per term. Backend explodes
 *   this into N FeeStructure records (one per term), each with one
 *   FeeStructureLevel per row.
 */

import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { FeeCategory } from '@prisma/client';

export class QuickMatrixExtra {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ enum: FeeCategory })
  @IsOptional()
  @IsEnum(FeeCategory)
  category?: FeeCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class QuickMatrixRow {
  @ApiProperty({ example: 'Grade 4' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gradeId?: string;

  /**
   * Map of termId -> tuition amount.
   */
  @ApiProperty({
    description: 'termId -> amount',
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  @IsObject()
  termAmounts!: Record<string, number>;

  /**
   * Map of termId -> array of extra components.
   */
  @ApiPropertyOptional({
    description: 'termId -> extras[]',
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: { $ref: getSchemaPath(QuickMatrixExtra) },
    },
  })
  @IsOptional()
  @IsObject()
  extras?: Record<string, QuickMatrixExtra[]>;
}

export class CreateQuickMatrixDto {
  @ApiProperty({ example: '2026 CBC Fees' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @ApiPropertyOptional({
    description: 'Restricts grade rows to a curriculum (recommended)',
  })
  @IsOptional()
  @IsString()
  curriculumId?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  termIds!: string[];

  @ApiPropertyOptional({ default: 'School Fees' })
  @IsOptional()
  @IsString()
  tuitionLabel?: string;

  @ApiProperty({ type: [QuickMatrixRow] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuickMatrixRow)
  rows!: QuickMatrixRow[];
}
