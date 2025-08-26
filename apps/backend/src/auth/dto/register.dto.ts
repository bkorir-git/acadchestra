import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'john.doe@school.edu' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  // @ApiProperty({ example: 'clxxx...', required: false })
  // @IsOptional()
  // @IsUUID()
  // tenantId?: string;

  @ApiProperty({ example: 'cmenvqh6z00003g1gi685dg6b', required: false })
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/, { message: 'tenantId must be a valid CUID' })
  tenantId: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}
