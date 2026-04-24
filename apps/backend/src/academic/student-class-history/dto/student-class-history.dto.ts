/**
 * @file student-class-history.dto.ts
 * @description DTOs for student class history ledger entries.
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateStudentClassHistoryDto {
  @ApiProperty()
  @IsString()
  studentId!: string;

  @ApiProperty()
  @IsString()
  classId!: string;

  @ApiProperty()
  @IsString()
  academicYearId!: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description:
      'Free-text reason: INITIAL_ENROLLMENT, AUTO_PROMOTION, MANUAL_PROMOTION, TRANSFER, STREAM_REASSIGNMENT, REPETITION, WITHDRAWAL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  stream?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

export class UpdateStudentClassHistoryDto extends PartialType(
  CreateStudentClassHistoryDto,
) {}
