import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsUrl,
  IsEnum,
  IsInt,
  Min,
  MaxLength,
  IsBoolean,
  MinLength,
} from 'class-validator';

export enum PlanType {
  LITE = 'LITE',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
  MULTI_SCHOOL = 'MULTI_SCHOOL',
}

export class CreateTenantDto {
  @ApiProperty({ example: 'Greenwood High School' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'greenwood-high.acadchestra.com' })
  @IsString()
  @MaxLength(100)
  domain!: string;

  @ApiProperty({ example: 'greenwood', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  subdomain?: string;

  @ApiProperty({ example: 'info@greenwood-high.edu' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '+254700000000', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Nairobi, Kenya', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'https://example.com/logo.png', required: false })
  @IsOptional()
  @IsUrl()
  logo?: string;

  @ApiProperty({ example: 'https://greenwood-high.edu', required: false })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiProperty({ enum: PlanType, default: PlanType.LITE })
  @IsOptional()
  @IsEnum(PlanType)
  planType?: PlanType;

  @ApiProperty({ example: 500, default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;

  @ApiProperty({ example: 'Mary' })
  @IsString()
  @MaxLength(50)
  adminFirstName!: string;

  @ApiProperty({ example: 'Wanjiku' })
  @IsString()
  @MaxLength(50)
  adminLastName!: string;

  @ApiProperty({ example: 'admin@greenwood-high.edu' })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ example: '+254711111111', required: false })
  @IsOptional()
  @IsString()
  adminPhone?: string;

  @ApiProperty({ example: 'Admin123!', required: false, description: 'Optional. If omitted, a temporary password will be generated.' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  adminPassword?: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  sendWelcomeEmail?: boolean;
}