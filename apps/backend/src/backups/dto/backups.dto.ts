import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateBackupPolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ example: '0 2 * * *' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  scheduleCron?: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  retentionKeep?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeUploads?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  remoteSync?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateBackupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeUploads?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncToR2?: boolean;
}

export class RestoreBackupDto {
  @ApiProperty({ description: 'BackupJob.id to restore from' })
  @IsString()
  backupJobId!: string;

  @ApiProperty({ description: 'SuperAdmin password for confirmation' })
  @IsString()
  @MinLength(6)
  adminPassword!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
