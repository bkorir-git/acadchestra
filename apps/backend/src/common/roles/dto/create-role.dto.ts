import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsOptional, IsArray } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Custom Teacher' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 'Custom teacher role with specific permissions', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ 
    example: ['ckv123abc0000xyz9efghijkl', 'ckv123def0000xyz9mnopqrstu'], 
    required: false,
    description: 'Array of permission CUIDs to assign to this role'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: 'Each permission ID must be a valid CUID string' })
  permissions?: string[];
}
