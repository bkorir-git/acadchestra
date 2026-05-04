/**
 * @file create-category.dto.ts
 * @description Payload to create a custom fee category. The base enum
 *   (`baseCategory`) groups the entity under one of the system-defined
 *   FeeCategory values for reporting consistency.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeeCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFeeCategoryDto {
  @ApiProperty({ example: 'Boarding (Optional)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional({
    description: 'Stable slug — auto-derived from name if omitted',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  code?: string;

  @ApiProperty({ enum: FeeCategory })
  @IsEnum(FeeCategory)
  baseCategory!: FeeCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ example: '#3b82f6' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
