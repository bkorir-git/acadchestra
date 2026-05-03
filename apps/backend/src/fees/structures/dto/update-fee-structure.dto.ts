/**
 * @file update-fee-structure.dto.ts
 * @description Partial update for an existing fee structure. When the
 *   structure is locked or already has student fees, `changeReason` is
 *   required and a new FeeStructureVersion snapshot is created.
 */

import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateFeeStructureDto } from './create-fee-structure.dto';

export class UpdateFeeStructureDto extends PartialType(CreateFeeStructureDto) {
  @ApiPropertyOptional({
    description: 'Required when updating a locked / billed structure',
  })
  @IsOptional()
  @IsString()
  changeReason?: string;
}
