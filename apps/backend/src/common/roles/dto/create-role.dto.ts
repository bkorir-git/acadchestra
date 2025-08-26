import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsOptional, IsArray, IsUUID } from 'class-validator';

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
    example: ['perm-id-1', 'perm-id-2'], 
    required: false,
    description: 'Array of permission IDs to assign to this role'
  })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  permissions?: string[];
}
