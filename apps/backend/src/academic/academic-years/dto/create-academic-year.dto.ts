/**
 * @description DTOs for academic year creation with custom or auto-generated terms.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TermStructure } from '@prisma/client';

export class CreateAcademicYearTermDto {
  @ApiProperty({ example: 'Term 1' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'T1' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  shortName?: string;

  @ApiProperty({ example: '2026-01-10' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-04-05' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  hasExams?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  hasFees?: boolean;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  examWeeks?: number;
}

export class CreateAcademicYearDto {
  @ApiProperty({ example: '2026-2027' })
  @IsString()
  @MinLength(4)
  @MaxLength(30)
  name!: string;

  @ApiProperty({ example: '2026-01-05' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-12-10' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({
    enum: TermStructure,
    default: TermStructure.THREE_TERMS,
  })
  @IsOptional()
  @IsEnum(TermStructure)
  termStructure?: TermStructure = TermStructure.THREE_TERMS;

  @ApiPropertyOptional({ example: 3, default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(12)
  totalTerms?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @ApiPropertyOptional({ type: [CreateAcademicYearTermDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAcademicYearTermDto)
  terms?: CreateAcademicYearTermDto[];
}
