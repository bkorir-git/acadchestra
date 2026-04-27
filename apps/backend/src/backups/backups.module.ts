import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../common/activity/activity.module';
import { ConfigModule } from '../common/config/config.module';
import { UploadsModule } from '../common/uploads/uploads.module';
import { BackupsService } from './backups.service';
import { RestoreService } from './restore.service';
import { BackupsController } from './backups.controller';
import { BackupsScheduler } from './backups.scheduler';
import { R2StorageProvider } from './storage/r2-storage.provider';

@Module({
  imports: [
    DatabaseModule,
    ActivityModule,
    ConfigModule,
    UploadsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [BackupsController],
  providers: [BackupsService, RestoreService, BackupsScheduler, R2StorageProvider],
  exports: [BackupsService, RestoreService],
})
export class BackupsModule {}
