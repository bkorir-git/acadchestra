/**
 * @file clone-academic-year.dto.ts
 * @description DTO for cloning an academic year.
 *   STRUCTURE is copied: terms, periods, streamsByGrade, classes (without
 *   students), and optionally fee structures.
 *   Students and enrollments are NEVER copied.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CloneAcademicYearDto {
  @ApiProperty({ example: '2027-2028' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  name!: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  copyStreamsConfig?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  copyTerms?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  copyPeriods?: boolean;

  @ApiPropertyOptional({
    default: true,
    description:
      'Copy class structure (without students) so the new year starts with a full roster',
  })
  @IsOptional()
  @IsBoolean()
  copyClasses?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  copyFeeStructures?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  setAsCurrent?: boolean;
}
