/**
 * @file change-password.dto.ts
 * @description Body shape for /auth/change-password. Complexity is enforced
 *   by PasswordPolicyService at runtime — no static @Matches() rule here.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentPass123!' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ example: 'NewSecurePass456!' })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
