/**
 * @file refresh-token.dto.ts
 * @description Body shape for /auth/refresh
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1...' })
  @IsString()
  refreshToken!: string;
}
