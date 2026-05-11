/**
 * @file update-user.dto.ts
 * @description Tenant is immutable post-creation, but role and password are
 *   still manageable during edit. `roleName` and `newPassword` are access-
 *   management fields handled specially by the service layer.
 */

import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'email', 'tenantId'] as const),
) {
  @ApiPropertyOptional({ example: 'Admin' })
  @IsOptional()
  @IsString()
  roleName?: string;

  @ApiPropertyOptional({ example: 'StrongerPassword123!' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword?: string;
}
