/**
 * @file admission-counter.dto.ts
 * @module common/admission-counter/dto

 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AdmissionStrategy } from '@prisma/client';

export class UpdateAdmissionCounterDto {
  @ApiPropertyOptional({ enum: AdmissionStrategy })
  @IsOptional()
  @IsEnum(AdmissionStrategy)
  strategy?: AdmissionStrategy;

  @ApiPropertyOptional({ example: 'GW' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  prefix?: string;

  @ApiPropertyOptional({ example: '2026' })
  @IsOptional()
  @IsString()
  @MaxLength(4)
  yearPrefix?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  paddingLength?: number;

  @ApiPropertyOptional({
    example: 100,
    description:
      'Set the next-issued sequence number. Cannot be lower than current.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  startAt?: number;
}
