import { Module } from '@nestjs/common';
import { AcademicYearsService } from './academic-years.service';
import { AcademicYearsController } from './academic-years.controller';
import { DatabaseModule } from '../../database/database.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ActivityModule } from '../../common/activity/activity.module';

@Module({
  imports: [DatabaseModule, EventEmitterModule, ActivityModule],
  controllers: [AcademicYearsController],
  providers: [AcademicYearsService],
  exports: [AcademicYearsService],
})
export class AcademicYearsModule {}
