import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({ 
    example: ['ckv123abc0000xyz9efghijkl', 'ckv123def0000xyz9mnopqrstu'],
    description: 'Array of permission CUIDs to assign to the role'
  })
  @IsArray()
  @IsString({ each: true, message: 'Each permission ID must be a valid CUID string' })
  @IsOptional()
  permissionIds: string[];
}
