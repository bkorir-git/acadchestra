/**
 * @file create-discount.dto.ts
 * @description Payload to apply a scholarship/discount to a student. The
 *   service writes a DISCOUNT ledger entry per matched StudentFee.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { DiscountScope, DiscountType } from '@prisma/client';

export class CreateDiscountDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @ApiProperty({ enum: DiscountScope })
  @IsEnum(DiscountScope)
  scope!: DiscountScope;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  componentName?: string;

  @ApiProperty()
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

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
  reason?: string;
}
