/**
 * @description Dashboard module wired to activity-powered recent feed.
 */

import { Module } from '@nestjs/common';
import { ActivityModule } from '../common/activity/activity.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ActivityModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
