import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({ 
    example: ['perm-id-1', 'perm-id-2'],
    description: 'Array of permission IDs to assign to the role'
  })
  @IsArray()
  @IsUUID(4, { each: true })
  permissionIds: string[];
}
