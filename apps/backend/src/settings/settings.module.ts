/**
 * @description Settings module registration.
 */

import { Module } from '@nestjs/common';
import { ActivityModule } from '../common/activity/activity.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [ActivityModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
