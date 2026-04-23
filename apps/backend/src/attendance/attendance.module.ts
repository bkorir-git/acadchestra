/**
 * @module AttendanceModule
 * @description Registers the attendance controller + service. Depends on the
 *   ActivityModule for audit logging. Exports AttendanceService so other
 *   modules (e.g. Dashboard, Reports) can reuse its rollups.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../common/activity/activity.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [DatabaseModule, ActivityModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
