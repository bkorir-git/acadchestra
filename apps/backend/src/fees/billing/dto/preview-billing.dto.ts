/**
 * @file preview-billing.dto.ts
 * @description Inputs to preview/execute a billing run. Preview is a dry
 *   run; execute commits the run inside a single transaction.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class PreviewBillingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  academicTermId?: string;

  @ApiPropertyOptional({ description: 'Filter to a specific structure' })
  @IsOptional()
  @IsString()
  feeStructureId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  studentIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  classIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  streamIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  gradeIds?: string[];
}

export class ExecuteBillingDto extends PreviewBillingDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  carryForwardArrears?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}