import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateTenantDto } from './create-tenant.dto';
import { IsString, MinLength, IsOptional } from 'class-validator';

export class UpdateTenantDto extends PartialType(CreateTenantDto) {}

export class DeleteTenantDto {
  @ApiProperty({ 
    example: 'admin_password_123',
    description: 'Admin password for security confirmation'
  })
  @IsString()
  @MinLength(8)
  adminPassword: string;
}
