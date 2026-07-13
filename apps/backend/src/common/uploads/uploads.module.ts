import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DatabaseModule } from '../../database/database.module';
import { ActivityModule } from '../../common/activity/activity.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { LocalStorageDriver } from './storage/local-storage.driver';
import { R2StorageDriver } from './storage/r2-storage.driver';
import { StorageService } from './storage/storage.service';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ActivityModule,
    MulterModule.register({
      storage: memoryStorage(), // service receives buffer, hands to storage driver
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  ],
  controllers: [UploadsController],
  providers: [
    UploadsService,
    LocalStorageDriver,
    R2StorageDriver,
    StorageService,
  ],
  exports: [UploadsService, StorageService],
})
export class UploadsModule {}
