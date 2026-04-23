/**
 * @module AcademicPeriodsModule
 */
import { Module } from '@nestjs/common';
import { AcademicPeriodsService } from './academic-periods.service';
import { AcademicPeriodsController } from './academic-periods.controller';
import { DatabaseModule } from '../../database/database.module';
import { ActivityModule } from '../../common/activity/activity.module';

@Module({
  imports: [DatabaseModule, ActivityModule],
  controllers: [AcademicPeriodsController],
  providers: [AcademicPeriodsService],
  exports: [AcademicPeriodsService],
})
export class AcademicPeriodsModule {}
