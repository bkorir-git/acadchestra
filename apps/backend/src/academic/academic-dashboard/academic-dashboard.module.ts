/**
 * @module AcademicDashboardModule
 * @description Academic-centric dashboard (progress + financials + class distribution).
 *   Separated from the generic "main dashboard" to give the academic domain its own
 *   high-density overview widget surface.
 */
import { Module } from '@nestjs/common';
import { AcademicDashboardService } from './academic-dashboard.service';
import { AcademicDashboardController } from './academic-dashboard.controller';
import { DatabaseModule } from '../../database/database.module';
import { ProgressModule } from '../../common/progress/progress.module';
import { ActivityModule } from '../../common/activity/activity.module';

@Module({
  imports: [DatabaseModule, ProgressModule, ActivityModule],
  controllers: [AcademicDashboardController],
  providers: [AcademicDashboardService],
  exports: [AcademicDashboardService],
})
export class AcademicDashboardModule {}
