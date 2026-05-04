/**
 * @file create-payment-rule.dto.ts
 * @description Payload to create a fee payment rule. Rules drive
 *   "by week N, X% must be paid" reminders and overdue detection.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePaymentRuleDto {
  @ApiProperty({ example: '50% by Week 2' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Null = applies to all terms' })
  @IsOptional()
  @IsString()
  termId?: string;

  @ApiProperty({ example: 2, description: 'By end of week N' })
  @IsInt()
  @Min(1)
  @Max(52)
  byWeek!: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(0)
  @Max(100)
  minPercentage!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lateFeePerDay?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}