/**
 * @file reset-password.dto.ts
 * @description Body shape for /auth/reset-password. Password complexity
 *   is enforced by PasswordPolicyService at runtime (config-driven), so
 *   we only do basic shape validation here.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1...' })
  @IsString()
  token!: string;

  @ApiProperty({ example: 'NewSecurePass123!' })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
