import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { CreateTenantDto } from './create-tenant.dto';

export class UpdateTenantDto extends PartialType(CreateTenantDto) {}

export class DeleteTenantDto {
  @ApiProperty({
    example: 'Admin123!',
    description: 'SuperAdmin password for confirmation',
  })
  @IsString()
  @MinLength(6)
  adminPassword!: string;
}
