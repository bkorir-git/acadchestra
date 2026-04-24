/**
 * @file promotion.dto.ts
 * @description DTOs for SINGLE promotions only. Bulk ops live in the Plan engine.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export type PromotionMode =
  | 'AUTO_PROMOTION'
  | 'MANUAL_PROMOTION'
  | 'REPETITION'
  | 'STREAM_REASSIGNMENT';

export class PromoteStudentDto {
  @ApiProperty()
  @IsString()
  studentId!: string;

  @ApiProperty()
  @IsString()
  newAcademicYearId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toClassId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  toStream?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiProperty({
    enum: [
      'AUTO_PROMOTION',
      'MANUAL_PROMOTION',
      'REPETITION',
      'STREAM_REASSIGNMENT',
    ],
    default: 'AUTO_PROMOTION',
  })
  @IsIn([
    'AUTO_PROMOTION',
    'MANUAL_PROMOTION',
    'REPETITION',
    'STREAM_REASSIGNMENT',
  ])
  mode!: PromotionMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
