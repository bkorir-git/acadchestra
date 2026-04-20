import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { AcademicNotificationsListener } from './listeners/academic-notifications.listener';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, AcademicNotificationsListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}