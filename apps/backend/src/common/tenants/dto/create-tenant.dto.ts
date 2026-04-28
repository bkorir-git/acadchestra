import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  subdomain?: string;

  @ApiProperty({ example: 'info@greenwood-high.edu' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Logo URL or upload asset URL' })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ enum: PlanType, default: PlanType.LITE })
  @IsOptional()
  @IsEnum(PlanType)
  planType?: PlanType;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;

  @ApiProperty()
  @IsString()
  @MaxLength(50)
  adminFirstName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(50)
  adminLastName!: string;

  @ApiProperty()
  @IsEmail()
  adminEmail!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminPhone?: string;

  @ApiPropertyOptional({ description: 'Optional. Generated if omitted.' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  adminPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sendWelcomeEmail?: boolean;
}
