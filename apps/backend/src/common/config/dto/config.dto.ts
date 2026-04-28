/**
 * @file config.dto.ts
 * @module common/config/dto
 * @description DTOs for config writes. We accept loose JSON values (any) but
 *   validate the SHAPE of the payload (object structure) — narrow validation
 *   happens at each consuming service via Zod schemas at the boundary.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class SetConfigCategoryDto {
  @ApiProperty({
    description: 'Object of key→value pairs for the targeted category.',
    example: { requireEmail: false, autoGenerateRollNumber: true },
  })
  @IsObject()
  values!: Record<string, unknown>;
}

export class SetConfigBulkDto {
  @ApiProperty({
    description:
      'Map of category → { key: value, ... }. Used by the onboarding wizard.',
    example: {
      student: { requireEmail: false, autoGenerateRollNumber: true },
      fee: { enableLateFees: true, lateFeePercentage: 5 },
    },
  })
  @IsObject()
  payload!: Record<string, Record<string, unknown>>;
}
